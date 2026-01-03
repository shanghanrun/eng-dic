import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public'; 

// console.log("📡 연결하려는 PB 주소:", PUBLIC_PB_URL);
export const pb = new PocketBase(PUBLIC_PB_URL)

