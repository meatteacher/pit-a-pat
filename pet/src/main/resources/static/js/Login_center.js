document.addEventListener('DOMContentLoaded', function() {
    console.log('Login_center.js 로드 완료');

    // 실제 친구 데이터를 저장할 변수
    let favoriteFriends = [];
    let selectedMainDogId = null;

    // 선택된 메인 강아지 ID 가져오기
    function getSelectedMainDogId() {
        // 1. 매칭에서 설정한 값 확인
        const matchSelected = localStorage.getItem('selectedMainDogId');
        if (matchSelected) {
            return parseInt(matchSelected);
        }

        // 2. 전역 변수 확인
        if (window.selectedMainDogId) {
            return parseInt(window.selectedMainDogId);
        }

        // 3. 첫 번째 강아지를 기본값으로
        if (window.dogsData && window.dogsData.length > 0) {
            return window.dogsData[0].dno;
        }

        return null;
    }

    // 프로필 순서 재배치 및 선택 표시
    function updateProfileOrder() {
        const selectedDogId = getSelectedMainDogId();
        if (!selectedDogId || !window.dogsData || window.dogsData.length === 0) {
            return;
        }

        console.log('선택된 강아지 ID:', selectedDogId);

        // 강아지 데이터 재정렬 (선택된 강아지를 맨 앞으로)
        const selectedDog = window.dogsData.find(dog => dog.dno === selectedDogId);
        if (!selectedDog) {
            console.log('선택된 강아지를 찾을 수 없음');
            return;
        }

        // 선택된 강아지를 제외한 나머지 강아지들
        const otherDogs = window.dogsData.filter(dog => dog.dno !== selectedDogId);

        // 재정렬된 순서
        const reorderedDogs = [selectedDog, ...otherDogs];

        // 프로필 그리드 다시 렌더링
        renderProfileGrid(reorderedDogs, selectedDogId);

        // 즐겨찾기 타이틀 업데이트
        updateFavoritesTitle(selectedDog.dname);

        console.log('프로필 순서 업데이트 완료:', selectedDog.dname);
    }

    // 프로필 그리드 렌더링
    function renderProfileGrid(dogs, selectedDogId) {
        const profilesGrid = document.querySelector('.profiles_grid');
        if (!profilesGrid) return;

        profilesGrid.innerHTML = '';

        dogs.forEach(dog => {
            const profileItem = document.createElement('div');
            profileItem.className = 'profile_item';
            profileItem.dataset.dogId = dog.dno;

            // 선택된 강아지인지 확인
            if (dog.dno === selectedDogId) {
                profileItem.classList.add('selected');
            }

            // 이미지 처리
            let imageHtml;
            if (dog.image && dog.image.diurl) {
                imageHtml = `<img src="${dog.image.diurl}" alt="${dog.dname} 프로필 이미지">`;
            } else {
                const firstLetter = dog.dname.charAt(0);
                imageHtml = `<span>${firstLetter}</span>`;
            }

            profileItem.innerHTML = `
                <div class="profile_image ${!dog.image || !dog.image.diurl ? 'profile_initial' : ''}">
                    ${imageHtml}
                </div>
                <div class="profile_name">${dog.dname}</div>
            `;

            // 클릭 이벤트 추가
            profileItem.addEventListener('click', function() {
                selectDog(dog.dno);
            });

            profilesGrid.appendChild(profileItem);
        });
    }

    // 강아지 선택 처리
    function selectDog(dogId) {
        console.log('강아지 선택됨:', dogId);

        // 로컬 스토리지에 저장
        localStorage.setItem('selectedMainDogId', dogId);
        window.selectedMainDogId = dogId;
        selectedMainDogId = dogId;

        // 프로필 순서 업데이트
        updateProfileOrder();

        // 친구 목록 다시 로드 (선택된 강아지 기준으로)
        loadFavoriteFriends();

        // 선택 알림
        const selectedDog = window.dogsData.find(dog => dog.dno === dogId);
        if (selectedDog) {
            showStatusNotification(`${selectedDog.dname}(으)로 프로필이 변경되었습니다.`, 'success');
        }
    }

    // 즐겨찾기 타이틀 업데이트
    function updateFavoritesTitle(dogName) {
        const favoritesTitle = document.querySelector('.favorites-title');
        if (favoritesTitle) {
            favoritesTitle.innerHTML = `<span class="selected-dog-name">${dogName}</span>의 친한 친구`;
        }
    }

    // 강아지 상태 변경 이벤트 설정
    function setupStatusChangeEvents() {
        const statusDropdowns = document.querySelectorAll('.status_dropdown');

        statusDropdowns.forEach(dropdown => {
            dropdown.addEventListener('change', function() {
                const dogId = parseInt(this.dataset.dogId);
                const newStatus = this.value;

                updateDogStatus(dogId, newStatus);
            });
        });
    }

    // 강아지 상태 업데이트 API 호출
    function updateDogStatus(dogId, status) {
        fetch('/dog/update-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `dogId=${dogId}&status=${encodeURIComponent(status)}`
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('상태 업데이트 성공:', data);
                    showStatusNotification(`상태가 "${status}"로 변경되었습니다.`, 'success');
                } else {
                    console.error('상태 업데이트 실패:', data.message);
                    showStatusNotification(data.message || '상태 변경에 실패했습니다.', 'error');

                    // 실패 시 이전 상태로 되돌리기
                    const dropdown = document.querySelector(`[data-dog-id="${dogId}"]`);
                    if (dropdown) {
                        dropdown.value = '온라인';
                    }
                }
            })
            .catch(error => {
                console.error('상태 업데이트 요청 실패:', error);
                showStatusNotification('네트워크 오류가 발생했습니다.', 'error');
            });
    }

    // 상태 변경 알림 표시
    function showStatusNotification(message, type = 'info') {
        // 기존 알림 제거
        const existingNotification = document.querySelector('.status-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 알림 색상 설정
        let bgColor = '#387FEB';
        if (type === 'success') bgColor = '#4CAF50';
        if (type === 'error') bgColor = '#f44336';

        // 알림 엘리먼트 생성
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 25px;
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease-out;
            max-width: 250px;
        `;

        document.body.appendChild(notification);

        // 3초 후 제거
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 3000);
    }

    // 월/일 선택 옵션 채우기
    function fillDateOptions() {
        const monthSelect = document.getElementById('birthMonth');
        const daySelect = document.getElementById('birthDay');

        if (monthSelect && monthSelect.options.length <= 1) {
            for(let i = 1; i <= 12; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                monthSelect.appendChild(option);
            }
        }

        if (daySelect && daySelect.options.length <= 1) {
            for(let i = 1; i <= 31; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                daySelect.appendChild(option);
            }
        }
    }

    // 모달 관련 요소들 - 안전하게 가져오기
    const modal = document.getElementById('modal');
    const addFamilyBtn = document.getElementById('addFamilyBtn');
    const cancelBtn = document.getElementById('cancelButton');
    const addPetBtn = document.getElementById('addPetButton');
    const imageUploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('fileInput');

    // 이미지 업로드 영역 클릭 이벤트
    if (imageUploadArea && fileInput) {
        imageUploadArea.addEventListener('click', function() {
            fileInput.click();
        });

        // 파일 선택 이벤트
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();

                reader.onload = function(e) {
                    imageUploadArea.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;">`;
                }

                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    // 새로운 가족 추가 버튼 클릭 이벤트
    if (addFamilyBtn && modal && imageUploadArea) {
        addFamilyBtn.addEventListener('click', function() {
            modal.style.display = 'block';
            fillDateOptions();

            // 폼 초기화
            const dogName = document.getElementById('dogName');
            const dogGender = document.getElementById('dogGender');
            const dogType = document.getElementById('dogType');
            const birthYear = document.getElementById('birthYear');
            const birthMonth = document.getElementById('birthMonth');
            const birthDay = document.getElementById('birthDay');
            const dogIntro = document.getElementById('dogIntro');

            if (dogName) dogName.value = '';
            if (dogGender) dogGender.selectedIndex = 0;
            if (dogType) dogType.value = '';
            if (birthYear) birthYear.selectedIndex = 0;
            if (birthMonth) birthMonth.selectedIndex = 0;
            if (birthDay) birthDay.selectedIndex = 0;
            if (dogIntro) dogIntro.value = '';
            imageUploadArea.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="29.015" height="29" viewBox="0 0 29.015 29">
                <path id="upload-image" d="M25.482,17.573A1.381,1.381,0,0,0,24.1,18.955v.525l-2.044-2.044a3.854,3.854,0,0,0-5.428,0l-.967.967-3.426-3.426a3.937,3.937,0,0,0-5.428,0L4.763,17.021V9.286A1.381,1.381,0,0,1,6.144,7.9h9.669a1.381,1.381,0,0,0,0-2.763H6.144A4.144,4.144,0,0,0,2,9.286V25.861A4.144,4.144,0,0,0,6.144,30H22.719a4.144,4.144,0,0,0,4.144-4.144V18.955A1.381,1.381,0,0,0,25.482,17.573ZM6.144,27.242a1.381,1.381,0,0,1-1.381-1.381V20.93l4.006-4.006a1.091,1.091,0,0,1,1.506,0L14.652,21.3h0l5.939,5.939ZM24.1,25.861a1.229,1.229,0,0,1-.249.732l-6.23-6.257.967-.967a1.064,1.064,0,0,1,1.519,0l3.992,4.02ZM30.606,5.542,26.462,1.4a1.428,1.428,0,0,0-1.961,0L20.357,5.542A1.387,1.387,0,0,0,22.319,7.5l1.782-1.8V13.43a1.381,1.381,0,1,0,2.763,0V5.708l1.782,1.8a1.387,1.387,0,1,0,1.961-1.961Z" transform="translate(-2 -1.005)" fill="#b7b7b7"/>
                </svg>
                <p class="upload-text">강아지 사진 올리기</p>
            `;
        });
    }

    // 취소 버튼 클릭 이벤트
    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }

    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', function(event) {
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 키워드 모달 관련 JavaScript
    const keywordModal = document.getElementById('keywordModal');
    const keywordCancelButton = document.getElementById('keywordCancelButton');
    const keywordPreviousButton = document.getElementById('keywordPreviousButton');
    const keywordCompleteButton = document.getElementById('keywordCompleteButton');
    const keywordButtons = document.querySelectorAll('.keyword-btn');

    // 가족 추가 모달의 다음 버튼 클릭 시 키워드 모달로 전환
    if (addPetBtn && modal && keywordModal) {
        addPetBtn.addEventListener('click', function() {
            // 기본 폼 검증
            const dogName = document.getElementById('dogName');
            if (!dogName || dogName.value.trim() === '') {
                alert('강아지 이름을 입력해주세요.');
                return;
            }

            modal.style.display = 'none';
            keywordModal.style.display = 'block';
        });
    }

    // 키워드 버튼 클릭 이벤트
    keywordButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('selected');
        });
    });

    // 키워드 모달 취소 버튼
    if (keywordCancelButton && keywordModal) {
        keywordCancelButton.addEventListener('click', function() {
            keywordModal.style.display = 'none';
        });
    }

    // 키워드 모달 이전 버튼
    if (keywordPreviousButton && keywordModal && modal) {
        keywordPreviousButton.addEventListener('click', function() {
            keywordModal.style.display = 'none';
            modal.style.display = 'block';
        });
    }

    // 키워드 모달 완료 버튼
    if (keywordCompleteButton && keywordModal) {
        keywordCompleteButton.addEventListener('click', function() {
            // 선택된 키워드 수집
            const selectedKeywords = [];
            document.querySelectorAll('.keyword-btn.selected').forEach(btn => {
                selectedKeywords.push(btn.textContent);
            });

            console.log('선택된 키워드:', selectedKeywords);

            // 모든 모달 닫기
            keywordModal.style.display = 'none';

            // 완료 메시지
            alert('가족 추가가 완료되었습니다!');
        });
    }

    // 모달 외부 클릭 시 닫기 이벤트 확장
    window.addEventListener('click', function(event) {
        if (keywordModal && event.target === keywordModal) {
            keywordModal.style.display = 'none';
        }
    });

    // 즐겨찾기 친구 목록 로드
    function loadFavoriteFriends() {
        fetch('/api/friends/favorites')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    favoriteFriends = data.friends;
                    renderFavoriteFriends();
                } else {
                    console.log('친구 목록 로드 실패:', data.message);
                    favoriteFriends = [];
                    renderFavoriteFriends();
                }
            })
            .catch(error => {
                console.error('즐겨찾기 친구 목록 로드 실패:', error);
                favoriteFriends = [];
                renderFavoriteFriends();
            });
    }

    // 즐겨찾기 친구 목록 렌더링
    function renderFavoriteFriends() {
        const friendList = document.getElementById('friendList');
        if (!friendList) return;

        friendList.innerHTML = '';

        if (favoriteFriends.length === 0) {
            friendList.innerHTML = `
           <div class="empty-friends">
               <div class="empty-friends-icon">🐕</div>
               <div>아직 친구가 없어요!</div>
               <div>매칭에서 새로운 친구를 찾아보세요</div>
           </div>
       `;
            return;
        }

        favoriteFriends.forEach(friend => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.dataset.friendRequestId = friend.friendRequestId;

            // 이미지 처리: 없으면 이름 첫 글자 표시
            let avatarHtml;
            if (friend.image && friend.image.diurl) {
                avatarHtml = `<img src="${friend.image.diurl}" alt="${friend.name}" class="friend-avatar">`;
            } else {
                const firstLetter = friend.name.charAt(0);
                avatarHtml = `
               <div class="friend-avatar" style="background-color: #387FEB; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">
                   ${firstLetter}
               </div>
           `;
            }

            friendItem.innerHTML = `
           <div class="friend-info">
               ${avatarHtml}
               <span class="friend-name">${friend.name}</span>
           </div>
           <div class="friend-actions">
               <span class="friend-status">${friend.status || '온라인'}</span>
               <button class="btn-remove hidden" data-id="${friend.id}">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <line x1="18" y1="6" x2="6" y2="18"></line>
                       <line x1="6" y1="6" x2="18" y2="18"></line>
                   </svg>
               </button>
           </div>
       `;

            friendList.appendChild(friendItem);
        });

        // 친구 프로필 클릭 이벤트 (바로 채팅)
        document.querySelectorAll('.friend-avatar').forEach(avatar => {
            avatar.addEventListener('click', function() {
                const friendRequestId = this.closest('.friend-item').dataset.friendRequestId;
                if (friendRequestId) {
                    openChatWindow(friendRequestId);
                }
            });
        });

        // 삭제 버튼 이벤트 리스너 추가
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', function() {
                const friendId = parseInt(this.dataset.id);
                removeFriend(friendId);
            });
        });
    }

    // 채팅창 열기 함수
    function openChatWindow(friendRequestId) {
        const chatWindow = window.open(
            `/chat/${friendRequestId}`,
            `chat_${friendRequestId}`,
            'width=600,height=800,scrollbars=yes,resizable=yes'
        );

        if (chatWindow) {
            chatWindow.focus();
        } else {
            alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
        }
    }

    // DOM 요소들
    const friendsContainer = document.getElementById('friendsContainer');
    const btnEdit = document.getElementById('btnEdit');
    const btnDone = document.getElementById('btnDone');
    const btnAddFriend = document.getElementById('btnAddFriend');

    // 편집 모드 토글 함수
    function toggleEditMode() {
        if (friendsContainer) {
            friendsContainer.classList.toggle('editing');
        }
        if (btnEdit) btnEdit.classList.toggle('hidden');
        if (btnDone) btnDone.classList.toggle('hidden');
    }

    // 친구 삭제 함수
    function removeFriend(id) {
        favoriteFriends = favoriteFriends.filter(friend => friend.id !== id);
        renderFavoriteFriends();
    }

    // 친구 추가 함수 (친구 목록 페이지로 이동)
    function addFriend() {
        window.location.href = '/dog-friends/list';
    }

    // 이벤트 리스너 설정
    if (btnEdit) btnEdit.addEventListener('click', toggleEditMode);
    if (btnDone) btnDone.addEventListener('click', toggleEditMode);
    if (btnAddFriend) btnAddFriend.addEventListener('click', addFriend);

    // 페이지 로드 시 초기화
    function initializeProfileOrder() {
        // 로그인된 상태에서만 실행
        if (window.dogsData && window.dogsData.length > 0) {
            // 선택된 강아지 ID 확인
            selectedMainDogId = getSelectedMainDogId();

            if (selectedMainDogId) {
                console.log('초기 선택된 강아지 ID:', selectedMainDogId);
                updateProfileOrder();
            } else {
                // 기본적으로 첫 번째 강아지 선택
                if (window.dogsData.length > 0) {
                    selectDog(window.dogsData[0].dno);
                }
            }
        }
    }

    // 매칭에서 돌아왔을 때 프로필 업데이트 감지
    function setupProfileUpdateListener() {
        // localStorage 변경 감지 (다른 탭에서 변경된 경우)
        window.addEventListener('storage', function(e) {
            if (e.key === 'selectedMainDogId' && e.newValue) {
                console.log('다른 탭에서 강아지 선택 변경됨:', e.newValue);
                selectedMainDogId = parseInt(e.newValue);
                updateProfileOrder();
                loadFavoriteFriends();
            }
        });

        // 페이지 포커스 시 확인 (같은 탭에서 매칭 페이지 다녀온 경우)
        window.addEventListener('focus', function() {
            const currentSelected = getSelectedMainDogId();
            if (currentSelected && currentSelected !== selectedMainDogId) {
                console.log('페이지 포커스 시 강아지 선택 변경 감지:', currentSelected);
                selectedMainDogId = currentSelected;
                updateProfileOrder();
                loadFavoriteFriends();
            }
        });
    }

    // 초기 렌더링 및 이벤트 설정
    setupStatusChangeEvents();
    setupProfileUpdateListener();
    initializeProfileOrder();
    loadFavoriteFriends();

    console.log('Login_center.js 초기화 완료');

    // 매칭 페이지에서 호출할 수 있도록 전역 함수로 노출
    window.updateProfileOrderFromMatch = function(dogId) {
        if (dogId) {
            localStorage.setItem('selectedMainDogId', dogId);
            window.selectedMainDogId = dogId;
            selectedMainDogId = dogId;
            updateProfileOrder();
            loadFavoriteFriends();
        }
    };
    // 프로필 변경 이벤트 리스너 추가
    window.addEventListener('profileChanged', function(e) {
        const { dogId, dogName } = e.detail;
        console.log('프로필 변경 이벤트 수신:', dogName);

        selectedMainDogId = dogId;
        updateProfileOrder();
        loadFavoriteFriends();
    });

});

// 애니메이션 CSS 추가
const style = document.createElement('style');
style.textContent = `
   @keyframes slideInRight {
       from { transform: translateX(100%); opacity: 0; }
       to { transform: translateX(0); opacity: 1; }
   }
   @keyframes slideOutRight {
       from { transform: translateX(0); opacity: 1; }
       to { transform: translateX(100%); opacity: 0; }
   }
`;
document.head.appendChild(style);