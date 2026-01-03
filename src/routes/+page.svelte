<script lang="ts">
    import { pb } from '../lib/pb';
    import { enhance } from '$app/forms';
    import type { PageData, ActionData } from './$types';
    import type { Word } from '$lib/types';
    import { invalidateAll } from '$app/navigation';
    
    let { data, form }: { data: PageData, form: ActionData } = $props();

    let currentView =$state<'eng_dic'|'eng_dic2'>('eng_dic') 
    let checkedIds = $state<string[]>([]) 
    let canMove = $derived(checkedIds.length >0)

    function toggleCheck(id: string){
        if(checkedIds.includes(id)){
            checkedIds = checkedIds.filter(i => i !== id)
        } else{
            checkedIds = [...checkedIds, id]
        }
    }

    async function moveCheckedWords() {
        if (checkedIds.length === 0) return;
        const targetCollection = currentView === 'eng_dic' ? 'eng_dic2' : 'eng_dic';
        const sourceCollection = currentView;
        
        if (!confirm(`${checkedIds.length}개의 단어를 이동할까요?`)) return;

        try {
            for (const id of checkedIds) {
                const record = (currentView === 'eng_dic' ? data.eng_dic : data.eng_dic2).find(w => w.id === id);
                if (!record) continue;

                // 전송할 데이터 객체 생성
                const formData = new FormData();
                formData.append('word', record.word);
                formData.append('meanings', record.meanings);
                formData.append('comment1', record.comment1 || '');
                formData.append('comment2', record.comment2 || '');
                formData.append('comment3', record.comment3 || '');

                // 이미지들을 순회하며 파일 데이터로 변환하여 추가
                for (let i = 1; i <= 3; i++) {
                    const fieldName = `image${i}`;
                    const fileName = record[fieldName];

                    if (fileName) {
                        try {
                            const imageUrl = getImageUrl(record, fileName);
                            const response = await fetch(imageUrl);
                            const blob = await response.blob();
                            // 파일명과 함께 blob 데이터를 추가 (PocketBase가 파일로 인식)
                            formData.append(fieldName, blob, fileName);
                        } catch (fileErr) {
                            console.error(`${fieldName} 복사 실패:`, fileErr);
                        }
                    }
                }

                // PocketBase SDK는 FormData를 받으면 자동으로 multipart/form-data로 전송합니다.
                await pb.collection(targetCollection).create(formData);
                
                // 이동 성공 후 원본 삭제
                await pb.collection(sourceCollection).delete(id);
            }
            
            checkedIds = []; 
            await invalidateAll(); 
            alert('이동이 완료되었습니다.');
        } catch (err) {
            console.error('이동 실패', err);
            alert('이동 중 오류가 발생했습니다.');
        }
    }

    let searchTerm = $state('');
    let selectedWord = $state<Word | null>(null);

    let editingId = $state<string | null>(null);
    let editWord = $state('');
    let editMeanings = $state('');
    let editComment1 = $state('')
    let editComment2 = $state('')
    let editComment3 = $state('')

    let showStatus = $state(false);
    let sortMode = $state('latest')

    const displayWords = $derived.by(() => {
        const source = currentView === 'eng_dic'? data.eng_dic: data.eng_dic2
        let list = searchTerm 
            ? source.filter(w => 
                w.word.toLowerCase().includes(searchTerm.toLowerCase()) || 
                w.meanings.includes(searchTerm)
              )
            : [...source];

        if (sortMode === 'asc') {
            return [...list].sort((a, b) => a.word.localeCompare(b.word));
        } else if (sortMode === 'desc') {
            return [...list].sort((a, b) => b.word.localeCompare(a.word));
        }
        return list;
    });

    let scrollContainer;
    function handleSort() {
        if (sortMode === 'asc') { sortMode = 'desc'; } 
        else { sortMode = 'asc'; }
        // 2. 정렬 후 스크롤을 맨 위로 이동
        
        // 특정 컨테이너 스크롤 조절
        if (scrollContainer) {
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    const startEdit = (word: Word) => {
        editingId = word.id;
        editWord = word.word;
        editMeanings = word.meanings;
        editComment1 = word.comment1 || ''
        editComment2 = word.comment2 || ''
        editComment3 = word.comment3 || ''
    };

    // 현재 뷰(eng_dic 또는 eng_dic2)를 기반으로 주소를 수동 조립하는 함수
    function getImageUrl(word, fileName) {
        if (!word || !fileName) return '';
        // collectionId가 없으므로 현재 보고 있는 currentView(컬렉션 이름)를 직접 사용합니다.
        return `${pb.baseUrl}/api/files/${currentView}/${word.id}/${fileName}`;
    }

    const cancelEdit = () => { editingId = null; };

    $effect(() => {
        if (displayWords.length > 0) {
            selectedWord = displayWords[0];
            // console.log(selectedWord.image1)
        } else {
            selectedWord = null;
        }
    });
    

    $effect(() => {
        if (form?.success) {
            sortMode = 'latest';
            showStatus = true;
            const timer = setTimeout(() => { showStatus = false; }, 2000);
            return () => clearTimeout(timer);
        }
    });

    const selectWord = (word: Word) => { selectedWord = word; };

    function speak(text: string) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US'; 
        window.speechSynthesis.speak(utterance);
    }
</script>

<div class="container">
    <section class="column-section scrollable">
        <div class="form-group registration-form">
            <h2>단어 등록</h2>
            <form method="POST" action="?/create" 
                use:enhance={() => {
                    // 1. 전송 시작 시 처리 (로딩 바 등)
                    return async ({ result, update }) => {
                        // 2. 서버 처리가 성공적으로 끝났을 때
                        if (result.type === 'success') {
                            // 데이터를 갱신합니다 (목록 리로드)
                            await update(); 
                            
                            // 3. 페이지 최상단으로 스크롤 이동
                            scrollContainer.scrollTo({
                                top: 0,
                                behavior: 'smooth' // 부드럽게 스크롤하려면 'smooth', 즉시 이동은 'auto'
                            });

                            // 성공 메시지나 입력창 초기화 등 추가 로직
                            console.log("새 단어로 스크롤 이동 완료!");
                        }
                    };
                }}
                enctype="multipart/form-data">
                <input type="hidden" name="collection" value={currentView} />
                <div class="input-stack">
                    <input name="word" placeholder="단어" required />
                    <input name="meanings" placeholder="뜻" required />
                    <textarea name="comment1" placeholder="기타 정보(예문 등) 1"></textarea>
                    <textarea name="comment2" placeholder="기타 정보(예문 등) 2"></textarea>
                    <textarea name="comment3" placeholder="기타 정보(예문 등) 3"></textarea>
                    <div class="file-stack">
                        <input name="image1" type="file" />
                        <input name="image2" type="file" />
                        <input name="image3" type="file" />
                    </div>
                </div>
                <button type="submit" class="btn-add">등록하기</button>
            </form>
        </div>

        <hr class="divider" />

        <div class="form-group">
            <h2 class="title-green">일괄 입력</h2>
            <form method="POST" action="?/bulkCreate" 
                use:enhance={()=>{
                    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }}>
                <input type="hidden" name="collection" value={currentView} />
                <textarea name="bulkText" class="bulk-textarea large-width" placeholder="단어(엔터)뜻(엔터)예문(엔터) 형식"></textarea>
                <button type="submit" class="btn-bulk">일괄 추가</button>
            </form>
        </div>

        <hr class="divider" />

        <div class="form-group">
            <h2 class="title-orange">엑셀 입력</h2>
            <form method="POST" action="?/excelCreate" 
                use:enhance={()=>{
                    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            >
                <input type="hidden" name="collection" value={currentView} />
                <textarea name="excelText" class="bulk-textarea large-width" placeholder="단어 | 뜻 | 예문 형식"></textarea>
                <button type="submit" class="btn-excel">엑셀 추가</button>
            </form>
        </div>
    </section>

    <section class="column-section list-border">
        <div class="collection-controls">
            <div class="tab-group">
                <button type="button" class="tab-btn" class:active={currentView === 'eng_dic'} onclick={() => { currentView = 'eng_dic'; checkedIds = []; }}>모든 단어장</button>
                <button type="button" class="tab-btn" class:active={currentView === 'eng_dic2'} onclick={() => { currentView = 'eng_dic2'; checkedIds = []; }}>중요 단어장</button>
            </div>
            <button type="button" class="btn-move" disabled={!canMove} onclick={moveCheckedWords}>체크를 이동하기 {canMove ? `(${checkedIds.length})` : ''}</button>
        </div>

        <div class="list-header">
            <h2 class="title-blue">목록 ({displayWords.length})</h2>
            <button type="button" class="btn-sort" onclick={handleSort}>sort {sortMode === 'asc' ? '▲' : sortMode === 'desc' ? '▼' : ''}</button>
        </div>

        <div class="search-box">
            <input type="text" bind:value={searchTerm} placeholder="검색어 입력" />
        </div>

        <ul class="word-list" bind:this={scrollContainer}>
            {#each displayWords as word (word.id)}
                <li role="presentation" onclick={() => selectWord(word)} class:active={selectedWord?.id === word.id}>
                    {#if editingId === word.id}
                        <div class="edit-inputs-container">
                            <div class="edit-group">
                                <label>수정 내용</label>
                                <input type="text" bind:value={editWord} class="full-input" />
                                <input type="text" bind:value={editMeanings} class="full-input" />
                                <textarea bind:value={editComment1} class="edit-textarea"></textarea>
                                <textarea bind:value={editComment2} class="edit-textarea"></textarea>
                                <textarea bind:value={editComment3} class="edit-textarea"></textarea>
                            </div>
                            <div class="edit-actions-bottom">
                                <form method="POST" action="?/update" use:enhance={() => {
                                    return async ({ update }) => { editingId = null; await update(); };
                                }} enctype="multipart/form-data"> 
                                    <input type="hidden" name="id" value={word.id} />
                                    <input type="hidden" name="collection" value={currentView} />
                                    <input type="hidden" name="word" value={editWord} />
                                    <input type="hidden" name="meanings" value={editMeanings} />
                                    <input type="hidden" name="comment1" value={editComment1} /> 
                                    <input type="hidden" name="comment2" value={editComment2} /> 
                                    <input type="hidden" name="comment3" value={editComment3} /> 
                                    <button type="submit" class="btn-confirm">저장</button>
                                </form>
                                <button class="btn-cancel" onclick={(e) => { e.stopPropagation(); cancelEdit(); }}>취소</button>
                            </div>
                        </div>
                    {:else}
                        <div class="word-info-row">
                            <div class="word-info">
                                <input type="checkbox" checked={checkedIds.includes(word.id)} 
                                    onclick={(e) => { e.stopPropagation(); toggleCheck(word.id); }} class="word-checkbox" />
                                <strong>{word.word}</strong> : {word.meanings}
                            </div>
                            <div class="word-actions">
                                <button class="btn-edit" onclick={(e) => { e.stopPropagation(); startEdit(word); }}>수정</button>
                                <form method="POST" action="?/delete" use:enhance>
                                    <input type="hidden" name="id" value={word.id} />
                                    <input type="hidden" name="collection" value={currentView} /> 
                                    <button type="submit" class="btn-delete" onclick={(e) => {
                                        e.stopPropagation();
                                        if (!confirm(`삭제할까요?`)) e.preventDefault();
                                    }}>삭제</button>
                                </form>
                            </div>
                        </div>
                    {/if}
                </li>
            {/each}
        </ul>
    </section>

    <section class="column-section detail-border">
        <h2>상세 정보</h2>
        <div class="detail-card scrollable"> {#if selectedWord}
                <div class="detail-content">
                    
                    {#if selectedWord.image1}
                        <div class="detail-image-box">
                            <img src={getImageUrl(selectedWord, selectedWord.image1)} alt={selectedWord.word} />
                        </div>
                    {/if}

                    <h2>
                        {selectedWord.word} 
                        <button class="btn-speaker" onclick={() => speak(selectedWord.word)}>🔊</button>
                    </h2>
                    <p class="meaning">{selectedWord.meanings}</p>
                    
                    {#if selectedWord.comment1}
                        <div class="etc-box main-comment">{selectedWord.comment1}</div>
                    {/if}

                    {#if selectedWord.image2 || selectedWord.comment2}
                        <hr class="section-divider" />
                        {#if selectedWord.image2}
                            <div class="detail-image-box">
                                <img src={getImageUrl(selectedWord, selectedWord.image2)} alt="추가 설명 이미지 1" />
                            </div>
                        {/if}
                        {#if selectedWord.comment2}
                            <div class="etc-box">{selectedWord.comment2}</div>
                        {/if}
                    {/if}

                    {#if selectedWord.image3 || selectedWord.comment3}
                        <hr class="section-divider" />
                        {#if selectedWord.image3}
                            <div class="detail-image-box">
                                <img src={getImageUrl(selectedWord, selectedWord.image3)} alt="추가 설명 이미지 2" />
                            </div>
                        {/if}
                        {#if selectedWord.comment3}
                            <div class="etc-box">{selectedWord.comment3}</div>
                        {/if}
                    {/if}

                </div>
            {:else}
                <p class="placeholder">단어를 선택해 주세요.</p>
            {/if}
        </div>
    </section>
</div>

<style>
    /* 1. 전체 레이아웃 */
    .container { 
        display: flex; 
        padding: 20px; 
        height: 100vh; 
        box-sizing: border-box; 
        overflow: hidden; 
        gap: 10px; 
        background-color: #f5f5f5;
    }

    .column-section { 
        flex: 1; 
        min-width: 380px; 
        display: flex; 
        flex-direction: column; 
        height: 100%; 
        padding: 0 15px; 
        background: white;
        border-radius: 8px;
    }

    .scrollable { overflow-y: auto; }
    .list-border, .detail-border { border-left: 1px solid #eee; }

    /* 2. 단어 등록 폼 */
    .input-stack { 
        display: flex; 
        flex-direction: column; 
        gap: 10px; 
        width: 100%; 
    }

    .input-stack input, 
    .input-stack textarea { 
        width: 100%; 
        box-sizing: border-box; 
        padding: 12px; 
        border: 1px solid #ccc; 
        border-radius: 6px; 
    }

    .file-stack { 
        display: flex; 
        flex-direction: column; 
        gap: 5px; 
        margin-top: 5px; 
    }

    /* 3. 상부 탭 및 이동 버튼 (초록색 박스 영역 복원) */
    .collection-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        gap: 10px;
    }

    .tab-group {
        display: flex;
        gap: 5px;
    }

    .tab-btn {
        padding: 8px 15px;
        background: #e0e0e0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }

    .tab-btn.active {
        background: #007bff;
        color: white;
    }

    .btn-move {
        background: #28a745; /* 초록색 버튼 */
        color: white;
        padding: 8px 15px;
        font-weight: bold;
        border-radius: 4px;
    }

    .btn-move:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    /* 4. 목록 헤더 및 검색창 */
    .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .search-box input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 15px;
        box-sizing: border-box;
    }

    /* 5. 단어 목록 및 선택 효과 (복원) */
    .word-list { 
        list-style: none; 
        padding: 0; 
        overflow-y: auto; 
        flex: 1; 
    }

    .word-list li { 
        border-bottom: 1px solid #f2f2f2; 
        cursor: pointer;
        transition: all 0.2s;
        border-left: 4px solid transparent; /* 선택 표시용 선 */
        box-shadow: 0 1px 2px rgba(0,0,0,0.05); /* 은은한 그림자 */
    }

    /* 단어가 선택되었을 때의 스타일 */
    .word-list li.active { 
        background-color: #e3f2fd; /* 연한 파란색 배경 */
        border-left: 4px solid #007bff; /* 왼쪽 파란색 강조선 */
    }

    .word-info-row { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 12px 10px; 
    }

    .word-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }

    /* 체크박스 크기 복원 */
    .word-checkbox {
        width: 20px;
        height: 20px;
        flex-shrink: 0; /* 내용이 길어져도 크기가 줄어들지 않도록 고정 */
        cursor: pointer;
        margin-right: 12px; /* 단어와의 간격 확보 */
    }

    .word-actions { 
        display: flex; 
        gap: 6px; 
    }

    /* 6. 편집 모드 */
    .edit-inputs-container { 
        
        padding: 15px; 
        background: #fff; 
        border: 2px solid #007bff; 
        border-radius: 8px; 
        margin: 5px; 
    }
    .edit-group{
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    .edit-group textarea{
        min-height: 100px;
        resize: vertical;      /* 세로로만 크기 조절 가능 */
    }

    .edit-actions-bottom { 
        display: flex; 
        gap: 10px; 
        margin-top: 10px;
    }

    .edit-actions-bottom form { flex: 1; display: flex; }
    
    .btn-confirm, .btn-cancel { 
        width: 100%; 
        height: 40px; 
        font-weight: bold; 
        border-radius: 4px;
    }

    .btn-confirm { background: #28a745; color: white; }
    .btn-cancel { background: #6c757d; color: white; flex: 1; }

    /* 7. 상세 정보 */
    .detail-card { 
        background: white; 
        border: 1px solid #ddd; 
        border-radius: 12px; 
        padding: 20px; 
    }

    .detail-image-box {
        width: 100%;
        display: flex;
        justify-content: center;
        margin-bottom: 20px;
        background: #f9f9f9;
        border-radius: 8px;
        overflow: hidden;
    }

    .detail-image-box img {
        max-width: 100%;
        max-height: 350px;
        object-fit: contain;
    }

    .etc-box { 
        background: #f8f9fa; 
        padding: 12px; 
        border-radius: 8px; 
        margin-top: 10px; 
        font-size: 0.95rem; 
        line-height: 1.5;
        white-space: pre-wrap; 
    }

    .main-comment { border-left: 4px solid #007bff; background: #f0f7ff; }
    .meaning { font-size: 20px; color: #333; margin: 10px 0; }
    .section-divider { border: 0; border-top: 1px dashed #ddd; margin: 20px 0; }

    button, .btn-sort, .btn-edit, .btn-delete {
        border-radius: 6px; /* 둥근 모서리 적용 */
        padding: 6px 12px;  /* 버튼 내부 여백 조정 */
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
    }

    .btn-edit { background: #ffc107; padding: 6px 12px; font-weight: bold; margin-left:5px}
    .btn-delete { background: #dc3545; color: white; padding: 6px 12px; font-weight: bold; }
    .btn-sort { background: #28a745; color: white; padding: 5px 10px; }
    .btn-add { width: 100%; background: #007bff; color: white; height: 45px; font-weight: bold; margin-top: 10px; }

    .collection-controls {
    background-color: #f8f9fa; /* 은은한 회색 배경 */
    padding: 20px;
    border-bottom: 1px solid #eee;
    border-radius: 8px 8px 0 0; /* 상단만 라운드 처리 */
    }

    .title-green { color: #198754; }
    .title-orange { color: #fd7e14; }

    /* 입력 폼 그룹 전체 스타일 */
    .form-group form {
        display: flex;
        flex-direction: column; /* 요소를 세로로 한 줄씩 배치 */
        gap: 12px;              /* 입력창과 버튼 사이의 간격 */
        align-items: stretch;   /* 자식 요소들이 가로로 꽉 차게 설정 */
    }

    /* 텍스트 영역 스타일 수정 */
    .bulk-textarea.large-width {
        width: 100%;            /* 가로 길이를 100%로 확장 */
        min-height: 120px;      /* 최소 높이 설정 */
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;     /* 요청하신 라운드 처리 적용 */
        box-sizing: border-box; /* 패딩이 너비에 영향을 주지 않도록 설정 */
        font-size: 1rem;
    }

    /* 일괄 추가 / 엑셀 추가 버튼 공통 스타일 */
    .btn-bulk, .btn-excel {
        width: 100%;            /* 버튼도 가로로 길게 확장 */
        padding: 12px;
        border-radius: 8px;     /* 라운드 처리 */
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        border: none;
        transition: background-color 0.2s;
    }
    .form-group form button{
        width: 100%;            /* 버튼도 가로로 길게 확장 */
        padding: 12px;
        border-radius: 8px;     /* 라운드 처리 */
        font-size: 1.1rem;
        font-weight: bold;
        cursor: pointer;
        border: none;
        transition: background-color 0.2s;
    }

    /* 일괄 추가 버튼 색상 (Green) */
    .btn-bulk {
        background-color: #2e8b57;
        color: white;
    }

    /* 엑셀 추가 버튼 색상 (Orange) */
    .btn-excel {
        background-color: #ffa500;
        color: white;
    }
</style>