"""
ArcSolve Plus FastAPI Application
메인 애플리케이션 파일 - 서버 설정 및 라우트 구성
"""

import os
from contextlib import asynccontextmanager
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# .env 파일 로드 (최우선)
load_dotenv()

from src.config.resources import resource_config
# Logging 먼저 초기화 (다른 모듈 import 전에)
from src.resources.logging import initialize_logging

initialize_logging(resource_config.logging)

from src.middlewares import extract_headers
# 이제 다른 모듈들 import (이미 telemetry가 초기화된 상태)
from src.resources.resource_provider import resource_provider

# 애플리케이션 메타데이터
APP_INFO = {
    "title": "ArcSolve API",
    "description": "ArcSolve - API Server",
    "version": "1.0.0", 
    "contact": {
        "name": "ArcSolve",
        "email": "support@arcsolve.ai"
    },
    "license_info": {
        "name": "ArcSolve",
        "url": "https://arcsolve.ai/license"
    }
}


 


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    애플리케이션 라이프사이클 관리
    시작 시 리소스 초기화, 종료 시 정리
    """
    # 모든 리소스 초기화 (Database + Service)
    try:
        await resource_provider.initialize_all()
    except Exception:
        # 개발 환경에서는 예외를 발생시키지 않고 계속 진행
        pass

    try:
        yield
    finally:
        try:
            # 모든 리소스 정리
            await resource_provider.close_all()
        except Exception:
            pass


# FastAPI 애플리케이션 인스턴스 생성
app = FastAPI(
    **APP_INFO,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)


# 미들웨어 등록
app.middleware("http")(extract_headers)


# 루트 엔드포인트
@app.get("/", response_model=Dict[str, Any])
async def root():
    """
    API 루트 엔드포인트
    서비스 정보 및 상태 반환
    """
    return {
        "service": APP_INFO["title"],
        "version": APP_INFO["version"],
        "status": "healthy",
        "message": "Welcome to ArcSolve Plus API"
    }


# 헬스체크 엔드포인트
@app.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    서비스 헬스체크 엔드포인트
    모든 리소스의 상태를 확인하고 반환
    """
    try:
        # 모든 리소스 헬스체크 (Database + Service)
        health_results = await resource_provider.health_check_all()
        
        return {
            "status": "healthy" if health_results.get("overall", False) else "unhealthy",
            "resources": health_results,
            "initialized": resource_provider.get_status(),
            "service": {
                "name": APP_INFO["title"],
                "version": APP_INFO["version"]
            }
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": "Health check failed",
                "message": str(e)
            }
        )


# API 정보 엔드포인트
@app.get("/info", response_model=Dict[str, Any])
async def api_info():
    """
    API 정보 엔드포인트
    서비스 메타데이터 반환
    """
    return {
        **APP_INFO,
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json",
            "health": "/health"
        }
    }


from src.routes.ai.route_for_tools import router as tools_router
# # 라우터 등록
from src.routes.business.route_for_parse import router as parse_router

app.include_router(parse_router)
app.include_router(tools_router)


if __name__ == "__main__":
    import argparse

    import uvicorn

    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    uvicorn.run(
        "main:app" if args.reload else app,
        host="0.0.0.0", 
        port=8000,
        log_level="info",
        access_log=True,
        reload=args.reload
    )
