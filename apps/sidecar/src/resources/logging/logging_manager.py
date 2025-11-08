"""
간소화된 LoggingManager - OpenTelemetry 초기화, 관리 및 데코레이터
"""

import asyncio
from functools import wraps
from typing import Callable, Optional

from opentelemetry import trace, metrics
from opentelemetry.trace import Status, StatusCode
from src.config.resources import LoggingConfig
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader


# 모듈 레벨 변수
_tracer_provider: Optional[TracerProvider] = None
_meter_provider: Optional[MeterProvider] = None
_initialized = False
_config: Optional[LoggingConfig] = None


def initialize_logging(config: LoggingConfig) -> bool:
    """
    OpenTelemetry를 초기화합니다.
    
    Args:
        config: LoggingConfig 인스턴스
        
    Returns:
        bool: 초기화 성공 여부
    """
    global _tracer_provider, _meter_provider, _initialized, _config
    
    if _initialized:
        return True
    
    try:
        _config = config
        
        # Resource 생성
        resource = Resource.create({
            "service.name": config.service_name,
            "service.version": config.service_version,
            "deployment.environment": config.environment,
        })
        
        # Tracer Provider 설정
        _tracer_provider = TracerProvider(resource=resource)
        
        # Span Processors 추가
        if config.otlp_endpoint:
            otlp_exporter = OTLPSpanExporter(endpoint=config.otlp_endpoint)
            _tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        
        if config.enable_console_export:
            _tracer_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        
        # Meter Provider 설정
        readers = []
        if config.otlp_endpoint:
            otlp_metric_exporter = OTLPMetricExporter(endpoint=config.otlp_endpoint)
            readers.append(PeriodicExportingMetricReader(otlp_metric_exporter))
        
        _meter_provider = MeterProvider(resource=resource, metric_readers=readers)
        
        # Global Provider 설정
        trace.set_tracer_provider(_tracer_provider)
        metrics.set_meter_provider(_meter_provider)
        
        _initialized = True
        return True
        
    except Exception as e:
        _initialized = True  # 재시도 방지
        return False


def get_tracer(name: str) -> trace.Tracer:
    """
    Tracer 인스턴스를 반환합니다.
    
    Args:
        name: Tracer 이름
        
    Returns:
        Tracer 인스턴스
    """
    version = _config.service_version if _config else "1.0.0"
    return trace.get_tracer(name, version)


def get_meter(name: str) -> metrics.Meter:
    """
    Meter 인스턴스를 반환합니다.
    
    Args:
        name: Meter 이름
        
    Returns:
        Meter 인스턴스
    """
    version = _config.service_version if _config else "1.0.0"
    return metrics.get_meter(name, version)


def is_initialized() -> bool:
    """초기화 상태를 확인합니다."""
    return _initialized


# === Tracing Decorators ===

def traced(operation_name: Optional[str] = None):
    """
    함수/메서드에 자동 추적을 추가하는 간소화된 데코레이터
    span에서 자동으로 duration, 예외, 상태를 모두 처리함
    """
    def decorator(func: Callable) -> Callable:
        tracer = get_tracer(func.__module__)
        span_name = operation_name or func.__name__
        
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(span_name) as span:
                    try:
                        result = await func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        raise
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(span_name) as span:
                    try:
                        result = func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        raise
            return sync_wrapper
    
    return decorator


def trace_class(cls):
    """
    클래스의 모든 public 메서드에 자동 추적을 추가하는 클래스 데코레이터
    """
    for attr_name in dir(cls):
        attr = getattr(cls, attr_name)
        if callable(attr) and not attr_name.startswith('_'):
            setattr(cls, attr_name, traced()(attr))
    return cls