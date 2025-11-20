from .normalizer import (
    NormalizerConfig,
    normalize,
    normalize_text_for_compare,
    suffix_prefix_overlap_len,
    join_lines_preserving_boundaries,
)

__all__ = [
    "NormalizerConfig",
    "normalize",
    "normalize_text_for_compare",
    "suffix_prefix_overlap_len",
    "join_lines_preserving_boundaries",
]


