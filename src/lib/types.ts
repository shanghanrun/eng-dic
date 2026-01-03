export interface Word {
    id: string;
    collectionId: string; // 이미지 URL 생성 시 필요할 수 있음
    collectionName: string;
    word: string;
    meanings: string;
    comment1: string;
    comment2: string;
    comment3: string;
    created?: string;
    // PocketBase에서 내려주는 값은 파일명이므로 string입니다.
    image1: string; 
    image2: string;
    image3: string;
}