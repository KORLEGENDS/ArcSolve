from __future__ import annotations

import logging
from dataclasses import dataclass

import torch  # type: ignore


@dataclass(frozen=True)
class RuntimeState:
    """런타임 상태 (CUDA/MPS 전용)

    - device_kind: "cuda" | "mps"
    - weights_dtype: 가중치 및 연산에 기본 사용할 dtype
    - autocast_enabled / autocast_dtype: 추론 시 자동 캐스팅 적용 여부/대상 dtype
    - supports_*: 환경에서 지원되는 최적화 기능
    """

    device_kind: str
    torch_device: torch.device
    weights_dtype: torch.dtype
    autocast_enabled: bool
    autocast_dtype: torch.dtype | None
    supports_bnb_int4: bool
    supports_flash_attn2: bool
    supports_torch_compile: bool

    @classmethod
    def detect(cls) -> "RuntimeState":
        # 디바이스 자동 결정: CUDA 우선 → MPS. 선호 입력 제거.
        kind: str | None = None
        if torch.cuda.is_available():
            kind = "cuda"
        if kind is None:
            try:
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    kind = "mps"
            except Exception:
                kind = None

        if kind is None:
            # 임시 정책: CUDA/MPS 미가용 시 CPU 허용
            kind = "cpu"

        if kind == "cuda":
            weights_dtype = torch.bfloat16
            autocast_enabled = True
            autocast_dtype = torch.float16
            supports_bnb_int4 = _has_bitsandbytes()
            supports_flash_attn2 = True
            supports_torch_compile = True
        elif kind == "mps":  # mps
            # 안정성 우선: MPS에서는 float32 고정 권장
            weights_dtype = torch.float32
            autocast_enabled = False
            autocast_dtype = None
            supports_bnb_int4 = False
            supports_flash_attn2 = False
            supports_torch_compile = False
        else:  # cpu
            weights_dtype = torch.float32
            autocast_enabled = False
            autocast_dtype = None
            supports_bnb_int4 = False
            supports_flash_attn2 = False
            supports_torch_compile = False

        state = cls(
            device_kind=kind,
            torch_device=torch.device(kind),
            weights_dtype=weights_dtype,
            autocast_enabled=autocast_enabled,
            autocast_dtype=autocast_dtype,
            supports_bnb_int4=supports_bnb_int4,
            supports_flash_attn2=supports_flash_attn2,
            supports_torch_compile=supports_torch_compile,
        )

        logging.info(
            "RuntimeState: device=%s, dtype=%s, bnb4bit=%s, fa2=%s, compile=%s",
            state.device_kind,
            str(state.weights_dtype).replace("torch.", ""),
            state.supports_bnb_int4,
            state.supports_flash_attn2,
            state.supports_torch_compile,
        )
        return state


def _has_bitsandbytes() -> bool:
    try:
        import bitsandbytes  # type: ignore  # noqa: F401
        return True
    except Exception:
        return False


