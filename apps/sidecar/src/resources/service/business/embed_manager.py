"""
임베딩 매니저 (MVP)
 - 청킹(RecursiveCharacterTextSplitter)
 - 임베딩 + 캐싱(SHA1 키)
 - Redis RediSearch 인덱스 보장(doc_id/chunk_idx/text/vector)
 - 청크 업서트
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Literal, Optional

import numpy as np
# LangChain text splitter (recursive)
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config.resources import resource_config
from src.config.runtime import RuntimeState
from src.config.services import service_config


class EmbedManager:
    def __init__(self, database_provider: Optional[object] = None, runtime: RuntimeState | None = None) -> None:
        self.config = service_config.embedding
        self.runtime = runtime or RuntimeState.detect()
        self._model = None
        self._reranker = None
        self._database_provider = database_provider

    def set_database_provider(self, database_provider: object) -> None:
        self._database_provider = database_provider

    # ===== sentence-transformers model =====
    @property
    def model(self):
        if self._model is None:
            # 지연 로딩 (GPU: cuda 권장). torch는 sentence-transformers 내부에서 로드
            from sentence_transformers import SentenceTransformer
            resolved = self.runtime.device_kind
            # 1:1 매핑: cuda → Snowflake Arctic, 그 외(mps/cpu) → e5-large-v2
            if resolved == "cuda":
                model_id = "Snowflake/snowflake-arctic-embed-l-v2.0"
                try:
                    self._model = SentenceTransformer(
                        model_id,
                        device=resolved,
                        trust_remote_code=True,  # type: ignore[arg-type]
                        model_kwargs={
                            "attn_implementation": "eager",
                            "use_memory_efficient_attention": False,
                        },
                    )
                except TypeError:
                    self._model = SentenceTransformer(model_id, device=resolved)
            else:
                model_id = "intfloat/e5-large-v2"
                self._model = SentenceTransformer(model_id, device=resolved)
        return self._model

    @property
    def reranker(self):
        if self._reranker is None:
            # Cross-Encoder로 리랭킹 모델 로드
            from sentence_transformers import CrossEncoder
            try:
                try:
                    self._reranker = CrossEncoder(self.config.reranker_model_id, trust_remote_code=True)  # type: ignore[arg-type]
                except TypeError:
                    self._reranker = CrossEncoder(self.config.reranker_model_id)
            except Exception:
                # 실패 시 가벼운 기본 모델로 폴백
                self._reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        return self._reranker

    # ===== helpers =====
    def _apply_query_prefix(self, texts: List[str], usage: Literal["query", "doc"]) -> List[str]:
        if usage == "query":
            return [f"query: {t}" for t in texts]
        return texts

    def _mrl_crop_and_norm(self, vectors: np.ndarray) -> np.ndarray:
        # 앞 256차원 슬라이스 후 L2 재정규화
        dim = self.config.mrl_dim
        arr = np.asarray(vectors, dtype=np.float32)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        arr = arr[:, :dim]
        # normalize
        norms = np.linalg.norm(arr, axis=1, keepdims=True) + 1e-12
        arr = arr / norms
        return arr.astype(np.float32, copy=False)

    # ===== public API =====
    def chunk_text(self, raw_text: str, *, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None) -> List[str]:
        """재귀 청킹.
        기본값은 설정의 chunk_size/overlap 사용.
        """
        size = int(chunk_size or self.config.chunk_size)
        overlap = int(chunk_overlap or self.config.chunk_overlap)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=size,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        return splitter.split_text(raw_text or "")

    def _encode_texts_no_cap(self, texts: List[str], usage: Literal["query", "doc"] = "doc") -> np.ndarray:
        if not texts:
            return np.zeros((0, self.config.mrl_dim), dtype=np.float32)
        max_chars = self.config.max_chars_per_text
        prepared = [t[:max_chars] for t in texts]
        prepared = self._apply_query_prefix(prepared, usage)
        vectors = self.model.encode(
            prepared,
            batch_size=min(64, len(prepared)),
            normalize_embeddings=self.config.normalize,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return self._mrl_crop_and_norm(vectors)

    async def encode_texts_cached(self, texts: List[str], usage: Literal["query", "doc"] = "doc") -> np.ndarray:
        """임베딩 계산(캐시 사용). 캐시 미스만 모델 추론.
        캐시 키: emb:v1:{usage}:{sha1}
        """
        if not texts:
            return np.zeros((0, self.config.mrl_dim), dtype=np.float32)

        # 해시 키 생성
        keys: List[str] = []
        for t in texts:
            h = hashlib.sha1((t or "").encode("utf-8")).hexdigest()
            keys.append(f"emb:v1:{usage}:{h}")

        # Redis 클라이언트 (없으면 캐시 미사용 경로)
        client = None
        try:
            client = await self._get_redis_client()
        except Exception:
            client = None

        cached_vectors: List[Optional[np.ndarray]] = [None] * len(texts)
        if client is not None:
            try:
                raw_vals = client.mget(keys)
                for i, raw in enumerate(raw_vals):
                    if raw is None:
                        continue
                    try:
                        arr = np.frombuffer(raw, dtype=np.float32)
                        if arr.size == self.config.mrl_dim:
                            cached_vectors[i] = arr
                    except Exception:
                        cached_vectors[i] = None
            except Exception:
                pass

        # 미스 수집
        miss_indices = [i for i, v in enumerate(cached_vectors) if v is None]
        if miss_indices:
            miss_texts = [texts[i] for i in miss_indices]
            miss_vectors = self._encode_texts_no_cap(miss_texts, usage=usage)

            # 캐시 저장
            if client is not None:
                try:
                    pipe = client.pipeline(transaction=False)
                    ttl = int(self.config.embed_cache_ttl_seconds or 0)
                    for offset, idx in enumerate(miss_indices):
                        key = keys[idx]
                        vec = np.asarray(miss_vectors[offset], dtype=np.float32).tobytes()
                        if ttl > 0:
                            pipe.set(key, vec, ex=ttl)
                        else:
                            pipe.set(key, vec)
                    pipe.execute()
                except Exception:
                    pass

            # 미스 채워넣기
            for offset, idx in enumerate(miss_indices):
                cached_vectors[idx] = miss_vectors[offset]

        # 전체 배열 조립
        stacked = np.vstack([np.asarray(v, dtype=np.float32) for v in cached_vectors]) if cached_vectors else np.zeros((0, self.config.mrl_dim), dtype=np.float32)
        return stacked

    # ===== Redis / RediSearch =====
    async def _get_redis_client(self):
        if self._database_provider is None:
            raise RuntimeError("EmbedManager: database_provider가 설정되지 않았습니다")
        redis_mgr = await self._database_provider.get_redis(resource_config.redis)
        # 내부 클라이언트 사용 (최소 변경)
        client = await redis_mgr._ensure_client()  # type: ignore[attr-defined]
        return client

    async def ensure_index(self) -> bool:
        if not self.config.use_redisearch:
            return False
        try:
            client = await self._get_redis_client()
            index = self.config.redis_index_name
            try:
                client.execute_command("FT.INFO", index)
                return True
            except Exception:
                pass

            # 인덱스 생성 (HASH, 키 프리픽스 사용)
            prefix = self.config.redis_key_prefix
            dim = self.config.mrl_dim
            metric = self.config.distance_metric
            client.execute_command(
                "FT.CREATE",
                index,
                "ON",
                "HASH",
                "PREFIX",
                1,
                prefix,
                "SCHEMA",
                "doc_id",
                "TAG",
                "chunk_idx",
                "NUMERIC",
                "text",
                "TEXT",
                "vector",
                "VECTOR",
                "HNSW",
                6,
                "TYPE",
                "FLOAT32",
                "DIM",
                dim,
                "DISTANCE_METRIC",
                metric,
            )
            return True
        except Exception:
            return False

    async def upsert_chunks(self, doc_id: str, chunks: List[str], vectors: np.ndarray) -> int:
        """청크 업서트 (HASH: doc_id, chunk_idx, text, vector)."""
        client = await self._get_redis_client()
        prefix = self.config.redis_key_prefix
        ttl = int(self.config.redis_ttl_seconds or 0)
        count = 0
        try:
            pipe = client.pipeline(transaction=False)
            for i, chunk in enumerate(chunks):
                key = f"{prefix}{doc_id}:{i}"
                vec_bytes = np.asarray(vectors[i], dtype=np.float32).tobytes()
                mapping = {
                    "doc_id": doc_id,
                    "chunk_idx": i,
                    "text": chunk,
                    "vector": vec_bytes,
                }
                pipe.hset(key, mapping=mapping)
                if ttl > 0:
                    pipe.expire(key, ttl)
                count += 1
            pipe.execute()
        except Exception:
            # 일부 실패 시 이미 반영된 수만큼 count 유지
            pass
        return count

    async def knn_search(self, query_vec: np.ndarray, k: int = 5, *, filter_doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if query_vec.ndim == 2:
            query_vec = query_vec[0]
        blob = np.asarray(query_vec, dtype=np.float32).tobytes()

        client = await self._get_redis_client()
        index = self.config.redis_index_name
        return_fields = ["doc_id", "chunk_idx", "text", "score"]
        try:
            # 필터 표현식 구성
            prefix_expr = f"@doc_id:{{{filter_doc_id}}} " if filter_doc_id else ""
            knn_expr = f"({prefix_expr})=>[KNN {int(k)} @vector $BLOB AS score]"
            resp = client.execute_command(
                "FT.SEARCH",
                index,
                knn_expr,
                "PARAMS",
                2,
                "BLOB",
                blob,
                "SORTBY",
                "score",
                "ASC",
                "RETURN",
                len(return_fields),
                *return_fields,
                "LIMIT",
                0,
                int(k),
                "DIALECT",
                2,
            )
        except Exception:
            return []

        results: List[Dict[str, Any]] = []
        try:
            idx = 1
            while idx < len(resp):
                key = resp[idx]
                fields = resp[idx + 1]
                idx += 2
                item: Dict[str, Any] = {"id": key}
                if isinstance(fields, list):
                    for j in range(0, len(fields), 2):
                        f = fields[j]
                        v = fields[j + 1]
                        if f == "score":
                            try:
                                item["score"] = float(v)
                            except Exception:
                                item["score"] = None
                        elif f == "doc_id":
                            item["doc_id"] = v.decode("utf-8", errors="ignore") if isinstance(v, (bytes, bytearray)) else v
                        elif f == "chunk_idx":
                            try:
                                item["chunk_idx"] = int(v)
                            except Exception:
                                item["chunk_idx"] = None
                        elif f == "text":
                            item["text"] = v.decode("utf-8", errors="ignore") if isinstance(v, (bytes, bytearray)) else v
                results.append(item)
        except Exception:
            return []
        return results

    def rerank(self, query: str, candidates: List[Dict[str, Any]], *, text_key: str = "text", top_k: int = 5) -> List[Dict[str, Any]]:
        """쿼리와 후보 텍스트를 Cross-Encoder로 리랭킹.
        candidates 항목에는 최소한 text_key가 있어야 함.
        반환은 상위 top_k로 잘라 점수(desc) 포함.
        """
        if not candidates:
            return []
        pairs = [(query, str(c.get(text_key, ""))) for c in candidates]
        try:
            scores = self.reranker.predict(pairs)
        except Exception:
            # 예외 시 벡터 점수(score) 있으면 그것으로 대체 정렬
            scores = [float(c.get("score", 0.0)) for c in candidates]
        ranked = []
        for c, s in zip(candidates, scores):
            item = dict(c)
            item["rerank_score"] = float(s)
            ranked.append(item)
        ranked.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)
        return ranked[: max(1, int(top_k))]

 
