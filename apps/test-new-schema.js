// 새로운 스키마 테스트 스크립트
import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:8080';
const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_ROOM_ID = '11111111-1111-1111-1111-111111111111';

console.log('🔌 WebSocket 연결 시도...');
const ws = new WebSocket(WS_URL);

let authenticated = false;
let joined = false;
let messageCount = 0;
let sendSuccess = false;

ws.on('open', () => {
  console.log('✅ WebSocket 연결 성공');
  console.log('🔐 인증 시도...');
  ws.send(JSON.stringify({ 
    op: 'auth', 
    token: TEST_USER_ID 
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  messageCount++;
  
  if (messageCount <= 3 || msg.op === 'send' || msg.op === 'event') {
    console.log(`\n📨 [${messageCount}] 수신:`, JSON.stringify(msg, null, 2));
  }
  
  if (msg.op === 'auth' && msg.success) {
    authenticated = true;
    console.log('✅ 인증 성공');
    console.log('🚪 채팅방 참가 시도...');
    ws.send(JSON.stringify({ 
      op: 'join', 
      room_id: TEST_ROOM_ID 
    }));
  } else if (msg.op === 'join' && msg.success) {
    joined = true;
    console.log('✅ 채팅방 참가 성공');
    console.log('💬 메시지 전송 시도...');
    setTimeout(() => {
      ws.send(JSON.stringify({ 
        op: 'send', 
        room_id: TEST_ROOM_ID,
        content: { text: '새 스키마 테스트 메시지 ' + Date.now() },
        temp_id: 'temp-' + Date.now()
      }));
    }, 1000);
  } else if (msg.op === 'send' && msg.success) {
    sendSuccess = true;
    console.log('✅ 메시지 전송 성공, message_id:', msg.message_id);
    console.log('\n⏳ 3초 후 종료...');
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 3000);
  } else if (msg.op === 'event' && msg.type === 'message.created' && msg.source === 'live') {
    console.log('📢 실시간 이벤트 수신:', msg.type);
    console.log('   메시지 ID:', msg.message?.id);
    console.log('   사용자 ID:', msg.message?.user_id);
    console.log('   내용:', msg.message?.content);
  } else if (msg.op === 'error') {
    console.error('❌ 오류:', msg.error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket 오류:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 연결 종료 (코드: ${code}, 이유: ${reason.toString()})`);
  console.log('\n📊 테스트 결과:');
  console.log(`   인증: ${authenticated ? '✅' : '❌'}`);
  console.log(`   채팅방 참가: ${joined ? '✅' : '❌'}`);
  console.log(`   메시지 전송: ${sendSuccess ? '✅' : '❌'}`);
  console.log(`   수신 메시지 수: ${messageCount}`);
  process.exit(sendSuccess ? 0 : 1);
});

// 타임아웃 설정 (30초)
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log('\n⏰ 타임아웃 - 연결 종료');
    ws.close();
  }
  process.exit(1);
}, 30000);
