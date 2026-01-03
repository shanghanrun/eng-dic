import { pb } from '../lib/pb';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit'


export const load: PageServerLoad = async () => {
    const fetchCollection = async (name: string) => {
        const records = await pb.collection(name).getFullList({ sort: '-created' }); // 최신순으로 정렬
        return records.map(r => ({ // record를 현재 타입으로 변환
            id: r.id,
            word: r.word,
            meanings: r.meanings,
            comment1: r.comment1,
            comment2: r.comment2,
            comment3: r.comment3,
            image1: r.image1,
            image2: r.image2,
            image3: r.image3,
            created: r.created
        }));
    };
    

    return {
        eng_dic: await fetchCollection('eng_dic'),
        eng_dic2: await fetchCollection('eng_dic2'),
    };
};

export const actions: Actions = {
    create: async ({ request }) => {
        const formData = await request.formData();
        const collectionName = (formData.get('collection') as string) || 'eng_dic';

        try {
            // 1. 관리자 권한 로그인 (Node.js 성공 코드의 핵심)
            // 주의: 실제 서비스라면 환경변수(process.env)를 사용하는 것이 안전합니다.
            await pb.collection('users').authWithPassword('id@2.com', '12345678');
            console.log("🔓 서버 액션 관리자 로그인 성공!");

            // 2. PocketBase에 보낼 새로운 FormData 생성
            const pbData = new FormData();
            
            // 텍스트 필드 복사
            pbData.append('word', (formData.get('word') as string) || '');
            pbData.append('meanings', (formData.get('meanings') as string) || '');
            pbData.append('comment1', (formData.get('comment1') as string) || '');
            pbData.append('comment2', (formData.get('comment2') as string) || '');
            pbData.append('comment3', (formData.get('comment3') as string) || '');

            // 3. 파일 처리 (브라우저에서 넘어온 File 객체를 그대로 전달)
            for (let i = 1; i <= 3; i++) {
                const file = formData.get(`image${i}`);
                // 파일이 존재하고 크기가 0보다 클 때만 추가
                if (file instanceof File && file.size > 0) {
                    pbData.append(`image${i}`, file);
                    console.log(`📸 이미지${i} 첨부 확인: ${file.name}`);
                }
            }

            // 4. PocketBase 서버로 전송
            const record = await pb.collection(collectionName).create(pbData);
            console.log(`✅ 저장 완료: ${record.id}`);

            // 성공 후 인증 정보 초기화 (보안)
            pb.authStore.clear();

            return { success: true };

        } catch (error: any) {
            console.error("❌ 상세 에러 정보:");
            console.error("상태 코드:", error.status); 
            console.error("에러 메시지:", error.message);
            console.error("서버 응답 데이터:", error.data); // 에러 원인을 찾는 가장 중요한 데이터
            
            return { 
                success: false, 
                error: error.message,
                details: error.data 
            };
        }
    },
	 delete: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const collectionName = (formData.get('collection') as string) || 'eng_dic';

        if (id) {
            try {
                // 포켓베이스에서 해당 ID의 레코드를 삭제
                await pb.collection(collectionName).delete(id);
            } catch (err) {
                console.error('삭제 실패:', err);
                return { success: false, message: '삭제에 실패했습니다.' };
            }
        }

        return { success: true };
    },
	update: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id') as string;
        //폼에서 보낸 컬렉션 이름을 읽는다. 없으면 기본 'words'
        const collectionName = (formData.get('collection') as string) ||'eng_dic'

        const word = (formData.get('word') as string) || ''
        const meanings = (formData.get('meanings') as string) || ''
        const comment1 = (formData.get('comment1') as string) || ''
        const comment2 = (formData.get('comment2') as string) || ''
        const comment3 = (formData.get('comment3') as string) || ''
        // const image1 = (formData.get('image1') as string) || '';
        // const image2 = (formData.get('image2') as string) || '';
        // const image3 = (formData.get('image3') as string) || '';

        if (id) {
            try {
                await pb.collection(collectionName).update(id, { word, meanings, comment1,comment2,comment3 });
            } catch (err) {
                console.error('수정 실패:', err);
                return { success: false };
            }
        }
        return { success: true };
    },
	bulkCreate: async ({ request }) => {
        const formData = await request.formData();
        const collectionName = (formData.get('collection') as string) || 'eng_dic';
        const text = formData.get('bulkText') as string;

        if (!text) return fail(400, { message: '입력된 내용이 없습니다.' });

        // 1. 데이터 전처리: 줄바꿈 기준으로 나누고 각 줄 앞뒤 공백 제거
        // .filter(line => line !== "") 를 통해 의미 없는 빈 줄은 제외합니다.
        // \r\n(윈도우)과 \n(유닉스) 모두 대응하는 정규식으로 줄바꿈 분리
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");


        // 2. 유효성 검사: 3의 배수인지 확인
        if (lines.length % 3 !== 0) {
            return fail(400, { 
                message: `형식이 맞지 않습니다. (현재 총 ${lines.length}줄 - 한 단어당 3줄씩 입력해주세요.)` 
            });
        }

        try {
            // Promise.all 대신 for 루프와 await를 사용하여 하나씩 확실히 저장합니다.
            // 이렇게 하면 어느 데이터에서 오류가 났는지 알기 쉽고 누락을 방지합니다.
            for (let i = 0; i < lines.length; i += 3) {
                await pb.collection(collectionName).create({
                    word: lines[i],
                    meanings: lines[i + 1],
                    comment1: lines[i + 2],
                });
            }

            return { 
                success: true, 
                message: `${lines.length / 3}개의 단어를 성공적으로 등록했습니다!` 
            };
        } catch (err) {
            console.error('일괄 등록 에러:', err);
            return fail(500, { success: false, message: '저장 중 오류가 발생했습니다.' });
        }
    },

	// 3. 엑셀 방식 등록 (단어 | 뜻 | 예문)
    excelCreate: async ({ request }) => {
        const formData = await request.formData();
        const collectionName = (formData.get('collection') as string) || 'eng_dic';
        const rawText = formData.get('excelText') as string;

        if (!rawText) return fail(400, { message: '내용을 입력해주세요.' });

        // 1. 줄바꿈 기준 분리 및 공백 제거
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");

        try {
            // 2. 순차적으로 저장 (안정성 확보)
            for (const line of lines) {
                // [핵심] 탭(\t) 기호로 분리
                const [word, meanings, comment1] = line.split('\t').map(s => s.trim());

                // 최소한 단어와 뜻은 있어야 등록 진행
                if (word && meanings) {
                    await pb.collection(collectionName).create({
                        word,
                        meanings,
                        comment1: comment1 || '', // etc가 없으면 빈 문자열 처리
                    });
                }
            }
            return { success: true, message: `${lines.length}개의 단어가 엑셀에서 복사되어 등록되었습니다!` };
        } catch (err) {
            console.error('엑셀 등록 에러:', err);
            return fail(500, { message: '등록 중 오류가 발생했습니다.' });
        }
    }

};