// 구글 캘린더 API 설정
const GOOGLE_CONFIG = {
    API_KEY: 'YOUR_GOOGLE_API_KEY', // 실제 API 키로 교체 필요
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID', // 실제 클라이언트 ID로 교체 필요
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/calendar'
};

// 캘린더 상태 관리
let calendarState = {
    isSignedIn: false,
    currentDate: new Date(),
    events: [],
    gapi: null,
    apiLoaded: false
};

let posts = []

// DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', function() {
    const gno = window.location.pathname.split("/").pop();

    fetch(`/board/api/groups/${gno}/posts`)
        .then(response => response.json())
        .then(data => {
            console.log(data); // 🔍 여기서 출력
            posts = data; // 전역 posts 배열에 넣기
            const container = document.querySelector('.board_member_row');
            posts.forEach((post, index) => {
                const element = createPostElement(post, index);
                container.appendChild(element);
            });
        })
        .catch(error => console.error("게시글 로딩 실패:", error));


    // 폼 submit 이벤트 잡기 (추가!)
    const createPostForm = document.getElementById('createPostForm');
    console.log('createPostForm:', createPostForm); // 여기도 찍어봐!
    createPostForm.addEventListener('submit', function(event) {
        event.preventDefault(); // 기본 submit 막기 (Ajax 방식으로 전송하려면!)

        const formData = new FormData(this);
        console.log('🐞 formData gno:', formData.get('gno'));
        fetch('/board/create', { // 📌 서버 주소
            method: 'POST',
            body: formData
        })
            .then(response => response.ok ? response.text() : Promise.reject(response))
            .then(data => {
                console.log('✅ 게시글 작성 성공:', data);

                // 모달 닫기
                hideCreatePostModal();

                // 이후 UI 업데이트 (예: 새 게시물 렌더링)
                createPosts(); // 혹은 게시물 새로고침

                // 메시지 표시 등...
                showSuccessMessage('게시글이 성공적으로 작성되었습니다! 🎉');
            })
            .catch(error => {
                console.error('❌ 게시글 작성 실패:', error);
            });
        document.querySelectorAll(".comment-options-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                const menu = e.target.nextElementSibling;
                menu.style.display = menu.style.display === "block" ? "none" : "block";
            });
        });

        document.querySelectorAll(".delete-comment-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                const commentItem = e.target.closest(".modal_text");
                const cno = commentItem.dataset.cno;
                if (confirm("정말 삭제하시겠습니까?")) {
                    fetch(`/api/comments/${cno}`, { method: "DELETE" })
                        .then(() => location.reload());
                }
            });
        });

        document.querySelectorAll(".edit-comment-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                const commentItem = e.target.closest(".modal_text");
                const cno = commentItem.dataset.cno;
                const oldText = commentItem.querySelector(".modal_post_text").innerText;
                const newText = prompt("댓글 수정", oldText);
                if (newText) {
                    fetch(`/api/comments/${cno}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ text: newText })
                    }).then(() => location.reload());
                }
            });
        });
    });
    console.log('🚀 페이지 로드 완료 - 초기화 시작');

    function loadMyGroupDogs(gno) {
        fetch(`/board/api/my-group-dogs?gno=${gno}`)
            .then(response => response.json())
            .then(data => {
                const select = document.getElementById('dno');
                select.innerHTML = '<option value="">-- 선택하세요 --</option>';
                data.forEach(dog => {
                    const option = document.createElement('option');
                    option.value = dog.dno;
                    option.textContent = dog.dname;
                    select.appendChild(option);
                });
            })
            .catch(error => console.error('❌ 강아지 목록 불러오기 실패:', error));
    }

    // 게시물 생성
    createPosts();

    // 캘린더 즉시 초기화 (API 없이)
    initializeCalendarImmediate();

    // 구글 API 초기화 (비동기)
    initializeGoogleAPI();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 캘린더 즉시 초기화 함수
    function initializeCalendarImmediate() {
        console.log('📅 캘린더 즉시 초기화 시작');
        renderCalendarNow();
        renderBasicEventsList();
    }

    // 캘린더 즉시 렌더링
    function renderCalendarNow() {
        const calendarDates = document.getElementById('calendarDates');
        const currentMonth = document.getElementById('currentMonth');

        console.log('📅 캘린더 요소 확인:', {
            calendarDates: !!calendarDates,
            currentMonth: !!currentMonth
        });

        if (!calendarDates || !currentMonth) {
            console.error('❌ 캘린더 요소를 찾을 수 없습니다');
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        currentMonth.textContent = `${year}년 ${month + 1}월`;
        console.log(`📅 현재 월 설정: ${year}년 ${month + 1}월`);

        // 월의 첫 날과 마지막 날
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // 달력 시작 날짜 (일요일부터 시작)
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() - firstDay.getDay());

        calendarDates.innerHTML = '';
        console.log('📅 날짜 생성 시작...');

        // 6주 * 7일 = 42개 날짜 생성
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);

            const dateElement = document.createElement('div');
            dateElement.className = 'calendar_date';
            dateElement.textContent = currentDate.getDate();

            // 현재 월이 아닌 날짜는 흐리게
            if (currentDate.getMonth() !== month) {
                dateElement.classList.add('other_month');
            }

            // 오늘 날짜 하이라이트
            if (isToday(currentDate)) {
                dateElement.classList.add('today');
                console.log('✅ 오늘 날짜 표시:', currentDate.getDate());
            }

            // 클릭 이벤트 추가
            dateElement.addEventListener('click', function() {
                console.log('날짜 클릭:', currentDate.getDate());
            });

            calendarDates.appendChild(dateElement);
        }

        console.log('✅ 캘린더 날짜 생성 완료 - 42개 날짜 표시');
    }

    // 오늘 날짜 확인 함수
    function isToday(date) {
        const today = new Date();
        return date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();
    }

    // 게시물 생성 함수
    function createPosts() {
        const leftContainer = document.querySelector('.group_board_left');
        const existingPosts = document.querySelectorAll('.group_board');

        // 기존 게시물 모두 제거
        existingPosts.forEach(post => post.remove());

        // for문으로 게시물 생성
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            const postElement = createPostElement(post, i);
            leftContainer.appendChild(postElement);
        }
    }

    // 개별 게시물 요소 생성 함수
    function createPostElement(post, index) {
        const postDiv = document.createElement('div');
        postDiv.className = 'group_board';
        postDiv.setAttribute('data-post-id', post.id);

        // const imageUrl = post.images.map(url => `<img src="${url}" alt="첨부 이미지" class="modal_main_image"/>`).join('');

        const imageUrl = (post.images || []).map(url => `<img src="${url}" alt="첨부 이미지" class="modal_main_image"/>`).join('');

        const dogName = post.writerDogName || '알 수 없음';
        console.log('🐞 createPostElement post:', post);
        postDiv.innerHTML = `
            <div class="group_boar_post_writer">
                <div class="group_board_writer">
                    <div class="post_user_info">
                        <div class="post_profile_img">
                            <img src="${post.userProfile}" alt="${post.writerDogName}" onerror="this.src='https://picsum.photos/40/40'"">
                        </div>
                        <div class="post_user_details">
                            <div class="board_write_user">${post.writerDogName}</div>
                            <span class="board_write_time">${post.timeAgo}</span>
                        </div>
                    </div>
                    <div class="post_menu_btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="5" height="23" viewBox="0 0 5 23">
                          <g id="그룹_162502" data-name="그룹 162502" transform="translate(-9196 -5930)">
                            <circle id="타원_9374" data-name="타원 9374" cx="2.5" cy="2.5" r="2.5" transform="translate(9196 5930)" fill="#b7b7b7"/>
                            <circle id="타원_9375" data-name="타원 9375" cx="2.5" cy="2.5" r="2.5" transform="translate(9196 5939)" fill="#b7b7b7"/>
                            <circle id="타원_9376" data-name="타원 9376" cx="2.5" cy="2.5" r="2.5" transform="translate(9196 5948)" fill="#b7b7b7"/>
                          </g>
                        </svg>
                    </div>
                </div>
                    <div class="board_post_img" data-post-index="${index}">
                        ${imageUrl}
                    </div>
                <div class="board_svg_row">
                    <div class="post_right_nav">
                        <div class="post_heart_icon" data-post-index="${index}">
                            <!-- SVG 좋아요 아이콘 -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="43.511" height="38.931" viewBox="0 0 43.511 38.931">
                              <path id="heart" d="M12.235,2.014a10.519,10.519,0,0,0-8.057,3C-.164,9.362.29,16.664,4.936,21.316L6.421,22.8,19.907,36.3a1.446,1.446,0,0,0,2.042,0L35.431,22.8l1.484-1.484c4.646-4.652,5.1-11.953.752-16.3s-11.629-3.885-16.273.764l-.469.469-.469-.469A12.614,12.614,0,0,0,12.235,2.014Z" transform="translate(0.831 0.005)" fill="none" stroke="#b7b7b7" stroke-width="4"/>
                            </svg>

                        </div>
                        <div class="post_comment_icon" data-post-index="${index}">
                            <!-- SVG 댓글 아이콘 -->
                            <svg xmlns="http://www.w3.org/2000/svg" width="39.506" height="39.452" viewBox="0 0 39.506 39.452">
                              <path id="chat" d="M13.862,19.752a1.972,1.972,0,1,0,1.973,1.972A1.972,1.972,0,0,0,13.862,19.752Zm7.89,0a1.972,1.972,0,1,0,1.973,1.972A1.972,1.972,0,0,0,21.753,19.752Zm7.89,0a1.972,1.972,0,1,0,1.973,1.972A1.972,1.972,0,0,0,29.643,19.752ZM21.753,2A19.725,19.725,0,0,0,2.027,21.725,19.508,19.508,0,0,0,6.485,34.211L2.54,38.156A1.923,1.923,0,0,0,4,41.45H21.753a19.725,19.725,0,1,0,0-39.45Zm0,35.5h-13l1.834-1.834a1.93,1.93,0,0,0,0-2.781A15.78,15.78,0,1,1,21.753,37.5Z" transform="translate(-1.972 -2)" fill="#b7b7b7"/>
                            </svg>

                        </div>
                    </div>
                    <div class="post_bookmark_icon" data-post-index="${index}">
                        <!-- SVG 북마크 아이콘 -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="33.069" height="44.093" viewBox="0 0 33.069 44.093">
                          <g id="bookmark" fill="none">
                            <path d="M30.314,0H2.756A2.756,2.756,0,0,0,0,2.756V41.337a2.756,2.756,0,0,0,4.477,2.152l12.057-9.646,12.057,9.646a2.756,2.756,0,0,0,4.477-2.152V2.756A2.756,2.756,0,0,0,30.314,0Z" stroke="none"/>
                            <path d="M 4.000003814697266 4 L 4.000003814697266 38.74836730957031 L 16.53466415405273 28.72048950195312 L 29.06933403015137 38.74837112426758 L 29.06933403015137 4 L 4.000003814697266 4 M 2.755783081054688 0 L 30.31355285644531 0 C 31.83553314208984 0 33.06933212280273 1.233798980712891 33.06933212280273 2.755779266357422 L 33.06933212280273 41.336669921875 C 33.06952285766602 42.3961296081543 32.46233367919922 43.36188125610352 31.5074634552002 43.82088088989258 C 30.55259323120117 44.27988052368164 29.41913414001465 44.15082931518555 28.59188270568848 43.48892974853516 L 16.53466415405273 33.84302139282227 L 4.477453231811523 43.48892974853516 C 3.650121688842773 44.15053176879883 2.516819000244141 44.2794075012207 1.561862945556641 43.82038116455078 C 0.6071434020996094 43.36135101318359 3.814697265625e-06 42.39577102661133 3.814697265625e-06 41.336669921875 L 3.814697265625e-06 2.755779266357422 C 3.814697265625e-06 1.233798980712891 1.233802795410156 0 2.755783081054688 0 Z" stroke="none" fill="#b8b8b8"/>
                          </g>
                        </svg>

                    </div>
                </div>
                <div class="post_content_section">
                    <span class="post_who_like"><!-- 여기다가 누구누구 외 몇명 좋아함 넣을것 --></span>
                    <div class="post_content">
                        <span class="post_username">${post.writerDogName}</span>
                        <span class="post_text">${post.bcontent}</span>
                    </div>
                    <span class="post_comment_count">
                        댓글 ${post.commentCount}개 모두 보기
                    </span>
                </div>
            </div>
        `;

        return postDiv;
    }

    // 모달 생성 함수
    function createModal(post, index) {
        const modal = document.createElement('div');
        const imagesHtml = post.images.map(url => `<img src="${url}" alt="첨부 이미지" class="modal_main_image"/>`).join('');
        modal.className = 'post_modal';
        modal.innerHTML = `
            <div class="modal_overlay">
                <div class="modal_content">
                    <div class="modal_close">&times;</div>
                    <div class="modal_left">
                        <div class="modal_image">
                            ${imagesHtml}
                        </div>
                    </div>
                    <div class="modal_right">
                        <div class="modal_header">
                            <div class="modal_user_info">
                                <div class="modal_profile">
                                    <!-- <img src="${post.userProfile}" alt="${post.username}""> -->
                                </div>
                                <div class="modal_user_details">
                                    <div class="modal_username">${post.writerDogName}</div>
                                    <div class="modal_time">${post.timeAgo}</div>
                                </div>
                            </div>
                            <div class="modal_menu_btn">⋮</div>
                        </div>
                        <div class="modal_content_area">
                            <div class="modal_post_content">
                                <div class="modal_profile_small">
                                    <!-- <img src="${post.userProfile}" alt="${post.username}"> -->
                                </div>
                                <div class="modal_text">
                                    <span class="modal_post_username">${post.writerDogName}</span>
                                    <span class="modal_post_text">${post.bcontent}</span>
                                    
                                </div>
                            </div>
                            <div class="modal_comments">
                            </div>
                            <div class="modal_likes"></div>
                            <div class="modal_comment_input">
                                <input type="text" placeholder="댓글 달기..." class="comment_input">
                                <button class="comment_submit">게시</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return modal;
    }

    // 모달 열기 함수
    function openModal(postIndex) {
        const post = posts[postIndex];
        const modal = createModal(post, postIndex);
        modal.setAttribute('data-bno', post.bno);
        document.body.appendChild(modal);

        // 댓글 불러오기
        fetch(`/board/api/comments/${post.bno}`)
            .then(response => response.json())
            .then(comments => {
                console.log('받아온 댓글:', comments);

                // 1️⃣ 댓글 개수 동적으로 업데이트
                const commentCountElement = document.querySelector(`.post_comment_count[data-post-id="${post.bno}"]`);
                if (commentCountElement) {
                    commentCountElement.textContent = `댓글 ${comments.length}개 모두 보기`;
                }

                // 2️⃣ 모달 내 댓글 목록 초기화 및 추가
                const commentContainer = modal.querySelector('.modal_comments');
                commentContainer.innerHTML = '';
                comments.forEach(comment => {
                    const commentItem = document.createElement('div');
                    commentItem.classList.add('comment_item');
                    commentItem.innerHTML = `
        <div class="comment_profile">
          <img src="https://via.placeholder.com/28x28/fd79a8/ffffff?text=🐕" alt="user">
        </div>
        <div class="comment_text">
          <span class="comment_username">${comment.dogName}</span>
          <span>${comment.bccomment}</span>
        </div>
      `;
                    commentContainer.appendChild(commentItem);
                });
            })
            .catch(err => console.error('❌ 댓글 로드 실패:', err));
        // 모달 애니메이션
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 배경 스크롤 방지
        document.body.style.overflow = 'hidden';

        // 모달 닫기 이벤트
        const closeBtn = modal.querySelector('.modal_close');
        const overlay = modal.querySelector('.modal_overlay');

        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                document.body.style.overflow = 'auto';
            }, 300);
        };

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // ESC 키로 모달 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // 모달 내 좋아요/북마크 이벤트
        const modalHeartIcon = modal.querySelector('.modal_heart_icon');
        const modalBookmarkIcon = modal.querySelector('.modal_bookmark_icon');

        if (modalHeartIcon) {
            modalHeartIcon.addEventListener('click', function() {
                const index = this.getAttribute('data-post-index');
                toggleLike(index);
                updateModalLikeState(modal, index);
            });
        }

        if (modalBookmarkIcon) {
            modalBookmarkIcon.addEventListener('click', function() {
                const index = this.getAttribute('data-post-index');
                toggleBookmark(index);
                updateModalBookmarkState(modal, index);
            });
        }
    }

    // 좋아요 토글 함수
    function toggleLike(index) {
        posts[index].liked = !posts[index].liked;
        updatePostLikeState(index);
    }

    // 북마크 토글 함수
    function toggleBookmark(index) {
        posts[index].bookmarked = !posts[index].bookmarked;
        updatePostBookmarkState(index);
    }

    // 게시물 좋아요 상태 업데이트
    function updatePostLikeState(index) {
        const heartIcons = document.querySelectorAll(`[data-post-index="${index}"].post_heart_icon`);
        heartIcons.forEach(icon => {
            if (posts[index].liked) {
                icon.classList.add('liked');
            } else {
                icon.classList.remove('liked');
            }
        });
    }

    // 게시물 북마크 상태 업데이트
    function updatePostBookmarkState(index) {
        const bookmarkIcons = document.querySelectorAll(`[data-post-index="${index}"].post_bookmark_icon`);
        bookmarkIcons.forEach(icon => {
            if (posts[index].bookmarked) {
                icon.classList.add('bookmarked');
            } else {
                icon.classList.remove('bookmarked');
            }
        });
    }

    // 모달 내 좋아요 상태 업데이트
    function updateModalLikeState(modal, index) {
        const heartIcon = modal.querySelector('.modal_heart_icon');
        if (posts[index].liked) {
            heartIcon.classList.add('liked');
        } else {
            heartIcon.classList.remove('liked');
        }
    }

    // 모달 내 북마크 상태 업데이트
    function updateModalBookmarkState(modal, index) {
        const bookmarkIcon = modal.querySelector('.modal_bookmark_icon');
        if (posts[index].bookmarked) {
            bookmarkIcon.classList.add('bookmarked');
        } else {
            bookmarkIcon.classList.remove('bookmarked');
        }
    }

    // 이벤트 위임을 사용한 클릭 이벤트
    document.addEventListener('click', function(e) {
        // 게시물 이미지 클릭 시 모달 열기
        if (e.target.classList.contains('board_post_img') || e.target.closest('.board_post_img')) {
            const postElement = e.target.closest('.board_post_img');
            if (postElement) {
                const postIndex = postElement.getAttribute('data-post-index');
                if (postIndex !== null) {
                    openModal(parseInt(postIndex));
                }
            }
        }

        // 댓글 작성

        if (e.target.classList.contains('comment_submit')) {
            const modal = e.target.closest('.post_modal');
            const input = modal.querySelector('.comment_input');
            const bccomment = input.value.trim();
            if (!bccomment) return;

            const bno = posts[modal.getAttribute('data-post-index')].id;

            const requestBody = { bno, dno, content: bccomment };

            fetch('/board/comment/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            })
                .then(response => response.json())
                .then(newComment => {
                    const commentContainer = modal.querySelector('.modal_comments');
                    const commentItem = document.createElement('div');
                    commentItem.classList.add('comment_item');
                    commentItem.innerHTML = `
          <div class="comment_profile">
            <img src="https://via.placeholder.com/28x28/fd79a8/ffffff?text=🐕" alt="user">
          </div>
          <div class="comment_text">
            <span class="comment_username">${newComment.dogName}</span>
            <span>${newComment.bccomment}</span>
          </div>
        `;
                    commentContainer.appendChild(commentItem);

                    input.value = '';
                })
                .catch(err => console.error('❌ 댓글 등록 실패:', err));
        }

        // 좋아요 버튼 클릭
        if (e.target.closest('.post_heart_icon')) {
            const heartIcon = e.target.closest('.post_heart_icon');
            const index = heartIcon.getAttribute('data-post-index');
            if (index !== null) {
                toggleLike(parseInt(index));

                // 애니메이션 효과
                heartIcon.style.transform = 'scale(1.3)';
                setTimeout(() => {
                    heartIcon.style.transform = 'scale(1)';
                }, 200);
            }
        }

        // 북마크 버튼 클릭
        if (e.target.closest('.post_bookmark_icon')) {
            const bookmarkIcon = e.target.closest('.post_bookmark_icon');
            const index = bookmarkIcon.getAttribute('data-post-index');
            if (index !== null) {
                toggleBookmark(parseInt(index));

                // 애니메이션 효과
                bookmarkIcon.style.transform = 'scale(1.2) rotate(10deg)';
                setTimeout(() => {
                    bookmarkIcon.style.transform = 'scale(1) rotate(0deg)';
                }, 300);
            }
        }

        // 댓글 아이콘 클릭
        if (e.target.closest('.post_comment_icon')) {
            const commentIcon = e.target.closest('.post_comment_icon');
            const index = commentIcon.getAttribute('data-post-index');
            if (index !== null) {
                openModal(parseInt(index));

                // 클릭 애니메이션
                commentIcon.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    commentIcon.style.transform = 'scale(1)';
                }, 150);
            }
        }
    });

    // 게시물 이미지 더블클릭 좋아요
    document.addEventListener('dblclick', function(e) {
        if (e.target.classList.contains('board_post_img') || e.target.closest('.board_post_img')) {
            const postElement = e.target.closest('.board_post_img');
            if (postElement) {
                const index = postElement.getAttribute('data-post-index');
                if (index !== null) {
                    posts[parseInt(index)].liked = true;
                    updatePostLikeState(parseInt(index));

                    // 하트 이펙트 생성
                    createHeartEffect(postElement);
                }
            }
        }
    });

    // 하트 이펙트 생성 함수
    function createHeartEffect(element) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.position = 'absolute';
        heart.style.fontSize = '30px';
        heart.style.top = '50%';
        heart.style.left = '50%';
        heart.style.transform = 'translate(-50%, -50%)';
        heart.style.pointerEvents = 'none';
        heart.style.zIndex = '1000';
        heart.style.animation = 'heartPop 0.8s ease-out forwards';

        element.style.position = 'relative';
        element.appendChild(heart);

        // 애니메이션 후 제거
        setTimeout(() => {
            if (heart.parentNode) {
                heart.parentNode.removeChild(heart);
            }
        }, 800);
    }

    // 게시글 추가 버튼 클릭 이벤트
    // const addPostBtn = document.querySelector('.add_post_btn');
    // if (addPostBtn) {
    //     addPostBtn.addEventListener('click', function() {
    //         console.log('📝 게시글 작성 모달 열기');
    //         const groupId = this.getAttribute('data-group-id'); // 예를 들어 data-group-id 속성으로 받아오도록!
    //         showCreatePostModal(groupId);
    //
    //         // 클릭 애니메이션
    //         this.style.transform = 'scale(0.95)';
    //         setTimeout(() => {
    //             this.style.transform = 'scale(1)';
    //         }, 100);
    //     });
    // }
    document.addEventListener('click', function(e) {
        console.log('🐞 e.target:', e.target);  // ⭐️ 클릭된 정확한 요소
        const addPostBtn = e.target.closest('.add_post_btn');
        console.log('🐞 addPostBtn:', addPostBtn);  // ⭐️ 찾은 add_post_btn (null이면 못 찾음!)

        if (addPostBtn) {
            const groupId = addPostBtn.getAttribute('data-group-id');
            console.log('✅ groupId (위임방식):', groupId);

            // ✅ 방어코드: groupId가 없으면 중단
            if (!groupId || groupId === 'undefined') {
                console.warn('⚠️ groupId가 undefined거나 비어있습니다. 요청 중단!');
                return;
            }

            showCreatePostModal(groupId);
        }
    });


    // 게시글 작성 모달 관련 함수들
    function showCreatePostModal(groupId) {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            console.log('✅ showCreatePostModal groupId:', groupId);
            loadMyGroupDogs(groupId);
            // 🪄 여기서 숨겨진 input에 gno 채워주기!
            const gnoInput = modal.querySelector('input[name="gno"]');
            if (gnoInput) {
                gnoInput.value = groupId; // groupId를 gno에 대입!
                console.log('✅ 그룹번호(gno) 입력 완료:', groupId);
            }

            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            document.body.style.overflow = 'hidden';

            // 폼 초기화
            resetCreatePostForm();

            // 이벤트 리스너 설정
            setupCreatePostModalEvents();
        }
    }

    document.addEventListener('click', function(e) {
        // 댓글 등록 버튼 클릭 처리
        if (e.target.classList.contains('comment_submit')) {
            const modal = e.target.closest('.post_modal');
            const input = modal.querySelector('.comment_input');
            const content = input.value.trim();
            if (!content) {
                alert('댓글 내용을 입력하세요!');
                return;
            }

            const bno = modal.getAttribute('data-bno');
            const dno = modal.getAttribute('data-dno'); // 예: 모달에 dno 저장했다면

            fetch('/board/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bno: bno,
                    dno: dno,
                    content: content
                })
            })
                .then(res => res.json())
                .then(data => {
                    console.log('✅ 댓글 등록 성공:', data);

                    // 입력칸 비우기
                    input.value = '';

                    // 댓글 목록에 추가
                    const commentsDiv = modal.querySelector('.modal_comments');
                    const commentHtml = `
                    <div class="comment_item">
                        <div class="comment_profile">
                            <img src="/img/default-profile.jpg" alt="user">
                        </div>
                        <div class="comment_text">
                            <span class="comment_username">${data.dogName}</span>
                            <span>${data.bccomment}</span>
                        </div>
                    </div>`;
                    commentsDiv.innerHTML += commentHtml;
                })
                .catch(err => {
                    console.error('❌ 댓글 등록 실패:', err);
                    alert('댓글 등록에 실패했습니다.');
                });
        }
    });

    function hideCreatePostModal() {
        const modal = document.getElementById('createPostModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
    }

    function resetCreatePostForm() {
        // 폼 필드 초기화
        const postContent = document.getElementById('postContent');
        if (postContent) postContent.value = '';

        // 이미지 초기화
        const imagePreview = document.getElementById('imagePreview');
        const imageUploadPlaceholder = document.getElementById('imageUploadPlaceholder');
        const imageActions = document.getElementById('imageActions');
        const imageUpload = document.getElementById('imageUpload');

        if (imagePreview) imagePreview.style.display = 'none';
        if (imageUploadPlaceholder) imageUploadPlaceholder.style.display = 'flex';
        if (imageActions) imageActions.style.display = 'none';
        if (imageUpload) imageUpload.value = '';

        // 게시하기 버튼 상태 초기화
        updateSaveButtonState();
    }

    function setupCreatePostModalEvents() {
        // 모달 닫기 이벤트들
        const closeBtn = document.getElementById('closeCreatePostModal');
        const cancelBtn = document.getElementById('cancelCreatePost');
        const modalOverlay = document.querySelector('#createPostModal .modal_overlay');

        const closeModal = () => hideCreatePostModal();

        if (closeBtn) {
            closeBtn.removeEventListener('click', closeModal);
            closeBtn.addEventListener('click', closeModal);
        }

        if (cancelBtn) {
            cancelBtn.removeEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    closeModal();
                }
            });
        }

        // 이미지 업로드 이벤트들
        setupImageUploadEvents();

        // 텍스트 입력 이벤트들
        setupTextInputEvents();

        // 게시하기 버튼 이벤트
        const saveBtn = document.getElementById('saveCreatePost');
        if (saveBtn) {
            // saveBtn.removeEventListener('click', handleCreatePost);
            // saveBtn.addEventListener('click', handleCreatePost);
            saveBtn.replaceWith(saveBtn.cloneNode(true));
        }
    }

    function setupImageUploadEvents() {
        const imageUpload = document.getElementById('imageUpload');
        const imageUploadPlaceholder = document.getElementById('imageUploadPlaceholder');
        const changeImageBtn = document.getElementById('changeImageBtn');
        const removeImageBtn = document.getElementById('removeImageBtn');
        const previewContainer = document.getElementById('imagePreviewContainer');

        // 플레이스홀더 클릭 시 파일 선택
        if (imageUploadPlaceholder) {
            imageUploadPlaceholder.addEventListener('click', () => {
                if (imageUpload) imageUpload.click();
            });
        }

        // 이미지 변경 버튼
        if (changeImageBtn) {
            changeImageBtn.addEventListener('click', () => {
                if (imageUpload) imageUpload.click();
            });
        }

        // 이미지 제거 버튼
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                resetImageUpload();
            });
        }

        // 파일 선택 시
        if (imageUpload) {
            imageUpload.addEventListener('change', handleImageSelect);
        }

        // 드래그 앤 드롭
        if (previewContainer) {
            previewContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                previewContainer.classList.add('drag_over');
            });

            previewContainer.addEventListener('dragleave', () => {
                previewContainer.classList.remove('drag_over');
            });

            previewContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                previewContainer.classList.remove('drag_over');

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    handleImageFile(files[0]);
                }
            });
        }
    }

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    }

    function handleImageFile(file) {
        // 파일 크기 체크 (5MB 제한)
        if (file.size > 5 * 1024 * 1024) {
            alert('파일 크기는 5MB 이하여야 합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imagePreview = document.getElementById('imagePreview');
            const imageUploadPlaceholder = document.getElementById('imageUploadPlaceholder');
            const imageActions = document.getElementById('imageActions');

            if (imagePreview) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            if (imageUploadPlaceholder) imageUploadPlaceholder.style.display = 'none';
            if (imageActions) imageActions.style.display = 'flex';

            updateSaveButtonState();
        };
        reader.readAsDataURL(file);
    }

    function resetImageUpload() {
        const imagePreview = document.getElementById('imagePreview');
        const imageUploadPlaceholder = document.getElementById('imageUploadPlaceholder');
        const imageActions = document.getElementById('imageActions');
        const imageUpload = document.getElementById('imageUpload');

        if (imagePreview) imagePreview.style.display = 'none';
        if (imageUploadPlaceholder) imageUploadPlaceholder.style.display = 'flex';
        if (imageActions) imageActions.style.display = 'none';
        if (imageUpload) imageUpload.value = '';

        updateSaveButtonState();
    }

    function setupTextInputEvents() {
        const postContent = document.getElementById('postContent');

        if (postContent) {
            postContent.addEventListener('input', () => {
                updateSaveButtonState();
            });
        }
    }

    function updateSaveButtonState() {
        const saveBtn = document.getElementById('saveCreatePost');
        const postContent = document.getElementById('postContent');
        const imagePreview = document.getElementById('imagePreview');

        if (saveBtn && postContent) {
            const hasContent = postContent.value.trim().length > 0;
            const hasImage = imagePreview && imagePreview.style.display === 'block';

            saveBtn.disabled = !(hasContent || hasImage);
        }
    }

    function handleCreatePost() {
        const postContent = document.getElementById('postContent');
        const imagePreview = document.getElementById('imagePreview');

        if (!postContent) return;

        const content = postContent.value.trim();

        // 새 게시물 데이터 생성
        const newPost = {
            id: posts.length + 1,
            username: "MyDog_" + Math.floor(Math.random() * 1000),
            userProfile: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=150&h=150&fit=crop&crop=face",
            timeAgo: "방금 전",
            image: imagePreview && imagePreview.style.display === 'block' ?
                imagePreview.src :
                `https://images.unsplash.com/photo-${1550000000000 + Math.floor(Math.random() * 100000000)}?w=800&h=600&fit=crop&auto=format&q=80`,
            likes: [],
            content: "새로운 게시글입니다",
            description: content || "새로운 게시글을 작성했습니다! 🐾",
            comments: 0,
            liked: false,
            bookmarked: false
        };

        // 게시물 배열에 추가
        posts.unshift(newPost);

        // 게시물 다시 렌더링
        createPosts();

        // 모달 닫기
        hideCreatePostModal();

        // 성공 메시지
        showSuccessMessage('게시글이 성공적으로 작성되었습니다! 🎉');

        console.log('✅ 새 게시글 생성:', newPost);
    }

    function showSuccessMessage(message) {
        // 간단한 토스트 메시지
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #4caf50, #66bb6a);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10001;
            font-weight: 500;
            transform: translateX(400px);
            transition: transform 0.3s ease;
        `;
        toast.textContent = message;

        document.body.appendChild(toast);

        // 애니메이션
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // 3초 후 제거
        setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        console.log('🎯 이벤트 리스너 설정 시작');

        // 구글 로그인 버튼
        const signInBtn = document.getElementById('googleSignInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', signInGoogle);
            console.log('✅ 구글 로그인 버튼 이벤트 설정');
        }

        // 캘린더 네비게이션
        const prevMonth = document.getElementById('prevMonth');
        const nextMonth = document.getElementById('nextMonth');

        if (prevMonth) {
            prevMonth.addEventListener('click', () => {
                console.log('◀ 이전 월 클릭');
                calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() - 1);
                renderCalendarNow();
            });
            console.log('✅ 이전 월 버튼 이벤트 설정');
        }

        if (nextMonth) {
            nextMonth.addEventListener('click', () => {
                console.log('▶ 다음 월 클릭');
                calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + 1);
                renderCalendarNow();
            });
            console.log('✅ 다음 월 버튼 이벤트 설정');
        }

        // 일정 추가 버튼
        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => {
                console.log('➕ 일정 추가 버튼 클릭');
                if (calendarState.isSignedIn && calendarState.apiLoaded) {
                    showEventModal();
                } else {
                    showEventModal(); // API 없어도 모달 표시
                }
            });
            console.log('✅ 일정 추가 버튼 이벤트 설정');
        }

        console.log('✅ 모든 이벤트 리스너 설정 완료');
    }

    // 기본 일정 목록 렌더링
    function renderBasicEventsList() {
        const eventsList = document.getElementById('eventsList');
        const noEvents = document.getElementById('noEvents');

        if (!eventsList) return;

        // API가 없을 때 샘플 일정 표시
        const sampleEvents = [
            { title: '강아지 산책 모임', date: '1월 15일' },
            { title: '반려견 훈련 클래스', date: '1월 20일' },
            { title: '펫샵 할인 행사', date: '1월 25일' }
        ];

        eventsList.innerHTML = '';

        sampleEvents.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'board_schedule_list';
            eventElement.innerHTML = `
                <div class="schedule_doc"></div>
                <div class="schedule_info">
                    <span class="schedule_date">${event.date}</span>
                    <span class="schedule_title">${event.title}</span>
                </div>
            `;
            eventsList.appendChild(eventElement);
        });

        console.log('✅ 기본 일정 목록 렌더링 완료');
    }

    // 이벤트 모달 표시
    function showEventModal() {
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            document.body.style.overflow = 'hidden';

            // 모달 닫기 이벤트 설정
            setupEventModalEvents();
        }
    }

    function hideEventModal() {
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
    }

    function setupEventModalEvents() {
        const modal = document.getElementById('eventModal');
        const closeBtn = document.getElementById('closeEventModal');
        const cancelBtn = document.getElementById('cancelEvent');
        const saveBtn = document.getElementById('saveEvent');
        const overlay = modal ? modal.querySelector('.modal_overlay') : null;

        const closeModal = () => hideEventModal();

        // 이벤트 리스너 중복 방지를 위해 제거 후 추가
        if (closeBtn) {
            closeBtn.removeEventListener('click', closeModal);
            closeBtn.addEventListener('click', closeModal);
        }

        if (cancelBtn) {
            cancelBtn.removeEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal();
                }
            });
        }

        // ESC 키로 모달 닫기
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // 저장 버튼 이벤트
        if (saveBtn) {
            saveBtn.removeEventListener('click', handleSaveEvent);
            saveBtn.addEventListener('click', handleSaveEvent);
        }
    }

    function handleSaveEvent() {
        const title = document.getElementById('eventTitle');
        const date = document.getElementById('eventDate');
        const time = document.getElementById('eventTime');
        const description = document.getElementById('eventDescription');
        const location = document.getElementById('eventLocation');

        if (!title || !date) {
            alert('제목과 날짜는 필수입니다.');
            return;
        }

        if (!title.value || !date.value) {
            alert('제목과 날짜는 필수입니다.');
            return;
        }

        // 이벤트 데이터 생성
        const newEvent = {
            title: title.value,
            date: date.value,
            time: time ? time.value : '',
            description: description ? description.value : '',
            location: location ? location.value : '',
            created: new Date().toISOString()
        };

        console.log('새 이벤트 생성:', newEvent);

        // 로컬에 저장
        addLocalEvent(newEvent);
        showSuccessMessage('일정이 추가되었습니다! 📅');
        hideEventModal();
        resetEventForm();
    }

    function addLocalEvent(event) {
        // 로컬 이벤트 목록에 추가
        if (!window.localEvents) {
            window.localEvents = [];
        }
        window.localEvents.push(event);

        // 일정 목록 업데이트
        updateLocalEventsList();
    }

    function updateLocalEventsList() {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList || !window.localEvents) return;

        eventsList.innerHTML = '';

        window.localEvents.slice(0, 3).forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = 'board_schedule_list';
            eventElement.innerHTML = `
                <div class="schedule_doc"></div>
                <div class="schedule_info">
                    <span class="schedule_date">${formatLocalEventDate(event.date)}</span>
                    <span class="schedule_title">${event.title}</span>
                </div>
            `;
            eventsList.appendChild(eventElement);
        });
    }

    function formatLocalEventDate(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
    }

    function resetEventForm() {
        const inputs = ['eventTitle', 'eventDate', 'eventTime', 'eventDescription', 'eventLocation'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    }

    // 구글 API 관련 함수들 (기본 구현)
    async function initializeGoogleAPI() {
        console.log('🔄 구글 API 초기화 시작...');
        console.warn('⚠️  구글 API 키가 설정되지 않았습니다. 기본 캘린더를 표시합니다.');
    }

    async function signInGoogle() {
        console.log('구글 로그인 시도');
    }

    // CSS 애니메이션 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        @keyframes heartPop {
            0% {
                transform: translate(-50%, -50%) scale(0);
                opacity: 1;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(0.8);
                opacity: 0;
            }
        }
        
        .post_heart_icon.liked svg path {
            fill: #ff6b6b;
            stroke: #ff6b6b;
        }
        
        .post_bookmark_icon.bookmarked svg path {
            fill: #ffd700;
            stroke: #ffd700;
        }
        
        .modal_heart_icon.liked svg path {
            fill: #ff6b6b;
            stroke: #ff6b6b;
        }
        
        .modal_bookmark_icon.bookmarked svg path {
            fill: #ffd700;
            stroke: #ffd700;
        }
        
        .post_heart_icon svg,
        .post_comment_icon svg,
        .post_share_icon svg,
        .post_bookmark_icon svg,
        .modal_heart_icon svg,
        .modal_comment_icon svg,
        .modal_share_icon svg,
        .modal_bookmark_icon svg {
            pointer-events: none;
        }
        
        .drag_over {
            border-color: #ff6b6b !important;
            background-color: #fff8f8 !important;
            transform: scale(1.02);
        }
    `;
    document.head.appendChild(style);

    // 페이지 로드 완료 애니메이션
    const elements = document.querySelectorAll('.group_board, .group_board_calendar, .group_board_schedule, .group_chat_list_box');
    elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';

        setTimeout(() => {
            element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * 100);
    });

    console.log('반려견 소셜 미팅 플랫폼 로드 완료! 🐾');
});