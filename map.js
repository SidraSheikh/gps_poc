const API_BASE_URL = 'http://localhost:3000';

async function initializeMap() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/first-point`);
        if (!response.ok) throw new Error('API for first-point failed');
        const firstPoint = await response.json();
        
        const map = L.map('map', {
            center: [firstPoint.lat, firstPoint.lng],
            zoom: 14, minZoom: 2, maxZoom: 18
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        setupOffsetCalculation(map);
        runMapLogic(map);

    } catch (error) {
        console.error('CRITICAL ERROR: Could not fetch initial point. Is the backend server running?', error);
        alert('Could not connect to the server. Please ensure the backend (server.js) is running and refresh the page.');
    }
}

function runMapLogic(map) {
    let cachedPoints = new Map();
    let currentMarkersLayer = new L.LayerGroup().addTo(map);
    const loadingIndicator = document.getElementById('loadingIndicator');

    const ZOOM_THRESHOLDS = [
        { zoom: 10, sampleRate: 50 }, { zoom: 12, sampleRate: 10 },
        { zoom: 14, sampleRate: 5 }, { zoom: 16, sampleRate: 2 },
        { zoom: 18, sampleRate: 1 }
    ];

    function getSampleRate(currentZoom) {
        for (const threshold of ZOOM_THRESHOLDS) {
            if (currentZoom < threshold.zoom) return threshold.sampleRate;
        }
        return 1;
    }

    function renderVisiblePoints() {
        currentMarkersLayer.clearLayers();
        const currentZoom = map.getZoom();
        const sampleRate = getSampleRate(currentZoom);
        const visibleBounds = map.getBounds();
        let renderedCount = 0;
        let totalCachedInView = 0;

        cachedPoints.forEach((point) => {
            const pointLatLng = L.latLng(point.lat, point.lng);
            if (visibleBounds.contains(pointLatLng)) {
                totalCachedInView++;
                if (sampleRate === 1 || point.id % sampleRate === 0) {
                    const marker = L.circleMarker(pointLatLng, {
                        radius: 4, color: '#3388ff', fillColor: '#3388ff',
                        fillOpacity: 0.7, weight: 1
                    });
                    marker.pointId = point.id;
                    marker.on('click', onPointClick);
                    currentMarkersLayer.addLayer(marker);
                    renderedCount++;
                }
            }
        });
        console.log(`Rendered ${renderedCount} points from ${totalCachedInView} in view.`);
    }

    async function onPointClick(e) {
        const clickedPointId = e.target.pointId;
        e.target.bindPopup('Loading details...').openPopup();
        try {
            const response = await fetch(`${API_BASE_URL}/api/point-details/${clickedPointId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const pointDetails = await response.json();
            const formattedTime = new Date(pointDetails.millis).toLocaleString();
            e.target.bindPopup(`
                <b>Frame ID:</b> ${pointDetails.id}<br>
                <b>Frame Time (float):</b> ${pointDetails.frame_time.toFixed(3)}<br>
                <b>Speed:</b> ${pointDetails.speed} km/h<br>
                <b>Group ID:</b> ${pointDetails.group_id}<br>
                <b>Video Index:</b> ${pointDetails.video_index}
            `).openPopup();
        } catch (error) {
            console.error('Error fetching point details:', error);
            e.target.bindPopup('Error loading details.').openPopup();
        }
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const fetchNewPoints = async () => {
        loadingIndicator.style.display = 'block';
        const extendedBounds = map.getBounds().pad(0.5);

        const queryParams = new URLSearchParams({
            minLng: extendedBounds.getWest(), minLat: extendedBounds.getSouth(),
            maxLng: extendedBounds.getEast(), maxLat: extendedBounds.getNorth()
        }).toString();

        try {
            const response = await fetch(`${API_BASE_URL}/api/map-points?${queryParams}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const newPoints = await response.json();
            let pointsAdded = 0;
            newPoints.forEach(point => {
                if (!cachedPoints.has(point.id)) {
                    cachedPoints.set(point.id, point);
                    pointsAdded++;
                }
            });
            console.log(`Fetched ${newPoints.length} points, added ${pointsAdded} new. Total cached: ${cachedPoints.size}`);
            renderVisiblePoints();
        } catch (error) {
            console.error('Error fetching map points:', error);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    };
    
    const debouncedFetchAndRender = debounce(fetchNewPoints, 300);
    fetchNewPoints(); // Initial fetch
    map.on('moveend', debouncedFetchAndRender);
    map.on('zoomend', () => {
        debouncedFetchAndRender();
        renderVisiblePoints();
    });
}

function setupOffsetCalculation(map) {
    const calculateBtn = document.getElementById('calculateOffsetBtn');
    if (!calculateBtn) return;
    const offsetMarkersLayer = L.layerGroup().addTo(map);
    calculateBtn.addEventListener('click', () => {
        offsetMarkersLayer.clearLayers();
        const centerPoint = map.getCenter();
        const bounds = map.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        const viewportHeight = map.distance({ lat: northEast.lat, lng: centerPoint.lng }, { lat: southWest.lat, lng: centerPoint.lng });
        const viewportWidth = map.distance({ lat: centerPoint.lat, lng: northEast.lng }, { lat: centerPoint.lat, lng: southWest.lng });
        const verticalOffsetDistance = (viewportHeight / 2) * 0.5;
        const horizontalOffsetDistance = (viewportWidth / 2) * 0.5;
        const northPoint = calculateDestinationPoint(centerPoint.lat, centerPoint.lng, 0, verticalOffsetDistance);
        const eastPoint = calculateDestinationPoint(centerPoint.lat, centerPoint.lng, 90, horizontalOffsetDistance);
        const southPoint = calculateDestinationPoint(centerPoint.lat, centerPoint.lng, 180, verticalOffsetDistance);
        const westPoint = calculateDestinationPoint(centerPoint.lat, centerPoint.lng, 270, horizontalOffsetDistance);
        const redMarkerIcon = L.icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
        L.marker([northPoint.lat, northPoint.lng], { icon: redMarkerIcon }).addTo(offsetMarkersLayer).bindPopup("<b>North Offset Point</b>");
        L.marker([eastPoint.lat, eastPoint.lng], { icon: redMarkerIcon }).addTo(offsetMarkersLayer).bindPopup("<b>East Offset Point</b>");
        L.marker([southPoint.lat, southPoint.lng], { icon: redMarkerIcon }).addTo(offsetMarkersLayer).bindPopup("<b>South Offset Point</b>");
        L.marker([westPoint.lat, westPoint.lng], { icon: redMarkerIcon }).addTo(offsetMarkersLayer).bindPopup("<b>West Offset Point</b>");
    });
}

function calculateDestinationPoint(lat, lng, bearing, distance) {
    const R = 6371e3;
    const latRad = lat * Math.PI / 180;
    const lonRad = lng * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    const latDestRad = Math.asin(Math.sin(latRad) * Math.cos(distance / R) + Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad));
    const lonDestRad = lonRad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad), Math.cos(distance / R) - Math.sin(latRad) * Math.sin(latDestRad));
    return { lat: latDestRad * 180 / Math.PI, lng: lonDestRad * 180 / Math.PI };
}

initializeMap();