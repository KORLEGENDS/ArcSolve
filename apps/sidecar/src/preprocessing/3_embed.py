"""
3단계: 임베딩 생성 단계 모듈.

역할:
- Snowflake Arctic Embed v2.0 (Medium)을 사용해 청킹된 텍스트를 임베딩한다.
- Matryoshka Representation Learning을 활용해 256차원으로 슬라이싱 후 정규화한다.

입력:
- chunks: list[str]

출력:
- embeddings: list[list[float]]  # 각 청크당 256차원 정규화 벡터
"""

from __future__ import annotations

from typing import List

import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer

# Snowflake Arctic Embed Model 설정
EMBED_MODEL_ID = "Snowflake/snowflake-arctic-embed-m-v2.0"  # 로컬 테스트용 Medium 권장
MATRYOSHKA_DIM = 256


def embed_chunks_step(chunks: List[str], model_id: str = EMBED_MODEL_ID, dim: int = MATRYOSHKA_DIM) -> List[List[float]]:
    """
    청킹된 텍스트 리스트를 Arctic Embed v2.0으로 임베딩한다.

    - chunks: 마크다운 청크 문자열 리스트
    - model_id: 사용할 Hugging Face 모델 ID
    - dim: Matryoshka 슬라이싱 후 사용할 차원 수
    """
    if not chunks:
        return []

    print(f"[embed] 모델 로딩: {model_id}")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    print(f"[embed] Device: {device}")

    # 토크나이저/모델 로드 (trust_remote_code=True 필요)
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    model = AutoModel.from_pretrained(
        model_id,
        trust_remote_code=True,
        add_pooling_layer=False,
        # xformers 의존성을 비활성화하기 위한 설정
        use_memory_efficient_attention=False,
        unpad_inputs=False,
        attn_implementation="eager",
    )
    model.to(device)
    model.eval()

    with torch.no_grad():
        inputs = tokenizer(
            chunks,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=8192,
        ).to(device)

        outputs = model(**inputs)
        # CLS 토큰 벡터 사용
        full_embeddings = outputs.last_hidden_state[:, 0]

        # Matryoshka 슬라이싱
        compressed_embeddings = full_embeddings[:, :dim]

        # 정규화
        compressed_embeddings = F.normalize(compressed_embeddings, p=2, dim=1)

    return compressed_embeddings.tolist()


