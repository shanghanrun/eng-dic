import PocketBase from 'pocketbase';
import fs from 'fs';
import { dic } from './src/lib/data.js';

const pb = new PocketBase('https://chois.cloud');

async function upload() {
    try {
        // 1. 관리자 로그인 (본인 계정 정보 입력)
        await pb.collection('users').authWithPassword('id@2.com', '12345678');
        console.log("🔓 로그인 성공!");

        for (const item of dic) {
            const formData = new FormData();
            
            // 데이터 필드 설정 (포켓베이스 필드명과 일치해야 함)
            formData.append('word', item.word);
            formData.append('meanings', item.meanings);
            formData.append('comment1', item.comment1 || '');
            formData.append('comment2', item.comment2 || '');
            formData.append('comment3', item.comment3 || '');

            // 파일 처리 함수
            const addFile = (fieldName, localPath) => {
                if (localPath) {
                    // static/image/파일명 형식으로 경로 설정
                    const filePath = `./static/${localPath}`; 
                    if (fs.existsSync(filePath)) {
                        const fileBuffer = fs.readFileSync(filePath);
                        const blob = new Blob([fileBuffer]);
                        formData.append(fieldName, blob, localPath.split('/').pop());
                    } else {
                        console.warn(`⚠️ 파일을 찾을 수 없음: ${filePath}`);
                    }
                }
            };

            addFile('image1', item.image1);
            addFile('image2', item.image2);
            addFile('image3', item.image3);

            // 'words' 대신 'eng_dic' 컬렉션 사용
            await pb.collection('eng_dic').create(formData);
            console.log(`✅ 업로드 완료: ${item.word}`);
        }
        console.log("🚀 모든 데이터가 성공적으로 서버에 저장되었습니다!");
    } catch (error) {
        console.error("❌ 상세 에러 정보:");
		console.error("상태 코드:", error.status); // 404면 경로 문제, 400이면 데이터 문제
		console.error("에러 메시지:", error.message);
		console.error("서버 응답:", error.data); // 서버가 보내는 상세 이유
    }
}

upload();