<script>
    import { onMount } from 'svelte';
    import { musicUI } from "../store/musicUI.svelte";

    let player = $state(null); 
    let playerContainer = $state(null);

    onMount(() => {
        // 1. 이미 API가 로드되어 있는지 확인
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            if (firstScriptTag && firstScriptTag.parentNode) {
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            }
        }

        // 전역 window 객체에 할당 (에디터의 불평을 잠재우기 위해 ['속성명'] 방식 사용)
        window['onYouTubeIframeAPIReady'] = () => {
            initPlayer();
        };

        // 이미 로드된 경우 바로 초기화
        if (window['YT'] && window['YT'].Player) {
            initPlayer();
        }
    });

    function initPlayer() {
        if (!musicUI.currentMusic || !playerContainer) return;
        
        const videoId = extractVideoId(musicUI.currentMusic.src);
        
        // window.YT 대신 window['YT']를 쓰면 에디터가 조용해집니다.
        player = new window['YT'].Player(playerContainer, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay':  1 ,
                'controls': 1,
                'origin': window.location.origin // 보안 및 도메인 허용 설정
            },
            events: {
                'onReady':(event)=>{
                    //플레이어가 준비되면 바로 재생 시도
                    if(musicUI.isPlaying){
                        event.target.playVideo()
                    }
                },
                'onStateChange': onPlayerStateChange
            }
        });
    }

    function onPlayerStateChange(event) {
        // event.data === 0 (종료됨)
        if (event.data === 0) {
            console.log("곡 종료 감지 - 다음 곡으로 강제 이동");
            // ⭐️ 여기서 currentMusic이 바뀌면 아래 $effect가 실행됩니다.
            musicUI.playNext(); 
        }
    }

    function extractVideoId(url) {
        if (url.includes('v=')) return url.split('v=')[1].split('&')[0];
        if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
        return url;
    }

    // ⭐️ 화면 크기 조절 시 중복 재생 방지 및 곡 유지 로직
    $effect(() => {
        // 1. currentMusic이 바뀔 때마다 실행됨을 보장
        const targetMusic = musicUI.currentMusic;
        if (!targetMusic || !player || !player.loadVideoById) return;

        const videoId = extractVideoId(targetMusic.src);
        
        // 2. 현재 플레이어 상태 확인
        // cueVideoById는 대기, loadVideoById는 즉시 재생 시도입니다.
        try {
            player.loadVideoById({
                videoId: videoId,
                startSeconds: 0,
                suggestedQuality: 'default'
            });
            
            // 3. 브라우저 정책 대응: 약간의 시차를 두고 재생 명령
            setTimeout(() => {
                if (musicUI.isPlaying) {
                    player.playVideo();
                }
            }, 100); 
        } catch (e) {
            console.error("재생 엔진 오류:", e);
        }
    });
</script>

<div class="video-container">
    {#if musicUI.currentMusic}
        <div class="iframe-wrapper">
            <div bind:this={playerContainer}></div>
        </div>
    {:else}
        <div class="placeholder">재생할 곡을 선택해주세요.</div>
    {/if}
</div>

<style>
    .video-container { width: 100%; background: #000; border-radius: 12px; overflow: hidden; 
    margin-bottom: 20px}
    .iframe-wrapper { position: relative; padding-top: 56.25%; height: 0; }
    .iframe-wrapper :global(iframe) { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .placeholder { height: 300px; display: flex; align-items: center; justify-content: center; color: #666; background: #f5f5f5; }
</style>