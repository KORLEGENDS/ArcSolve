"""
ArcSolve Plus Middlewares
HTTP 요청/응답 처리를 위한 미들웨어
"""

from fastapi import Request
from fastapi.responses import JSONResponse
import uuid


async def extract_headers(request: Request, call_next):
    """
    헤더에서 userId, fileId, projectId, threadId를 추출하여 request.state에 저장
    """
    # 헤더에서 ID들 추출
    user_id = request.headers.get("X-User-ID")
    file_id = request.headers.get("X-File-ID")
    project_id = request.headers.get("X-Project-ID") 
    thread_id = request.headers.get("X-Thread-ID")
    
    # file_id가 존재하면 UUID 형식인지 검증하여 잘못된 값일 경우 즉시 400 응답
    if file_id:
        file_id = file_id.strip()
        try:
            uuid.UUID(file_id)
        except Exception:
            return JSONResponse(status_code=400, content={"detail": "Invalid X-File-ID header: must be a UUID"})

    # request.state에 저장
    request.state.user_id = user_id
    request.state.file_id = file_id
    request.state.project_id = project_id
    request.state.thread_id = thread_id
    
    # 요청 처리 계속
    response = await call_next(request)
    
    return response