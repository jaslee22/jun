const CACHE_NAME = 'field-survey-gis-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    // Leaflet 마커 아이콘 이미지들 (자주 사용하는 것들)
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    // 이모지 (내 위치 버튼)
    // '📍' 이모지는 웹 폰트 또는 시스템 폰트에 포함되므로 별도 캐싱이 필요 없을 수 있습니다.
    // 필요한 경우 여기에 추가
];

// 설치 이벤트: 서비스 워커가 설치될 때 캐시에 리소스 추가
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// 활성화 이벤트: 이전 버전의 캐시를 정리
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // 서비스 워커가 활성화된 후 즉시 클라이언트에게 제어권을 넘겨줍니다.
    return self.clients.claim();
});

// 가져오기 (fetch) 이벤트: 네트워크 요청을 가로채서 캐시에서 응답하거나 네트워크 요청
self.addEventListener('fetch', event => {
    // OpenStreetMap 타일 요청은 캐시하지 않고 네트워크 우선으로 처리
    if (event.request.url.startsWith('https://tile.openstreetmap.org')) {
        event.respondWith(fetch(event.request)); // 네트워크에서 직접 가져옴
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // 캐시에 요청이 있으면 캐시된 응답 반환
                if (response) {
                    return response;
                }
                // 캐시에 없으면 네트워크 요청
                return fetch(event.request).then(
                    networkResponse => {
                        // 네트워크 응답이 유효하면 캐시에 저장 후 반환
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch(() => {
                    // 네트워크 요청 실패 시 오프라인 폴백 (예: 오프라인 페이지)
                    // 여기서는 단순히 아무것도 반환하지 않아 브라우저 기본 오프라인 동작을 따르게 합니다.
                    console.log('Network request failed for:', event.request.url);
                    // 특정 리소스(예: 이미지)에 대한 폴백이 필요한 경우 추가 로직
                    // if (event.request.destination === 'image') {
                    //     return caches.match('/images/offline-fallback.png');
                    // }
                });
            })
    );
});