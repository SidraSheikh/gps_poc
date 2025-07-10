const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());

// --- Dummy Data Generator ---
function generateDummyPoints(centerLat, centerLng, count) {
    const points = [];
    for (let i = 1; i <= count; i++) {
        points.push({
            id: Math.floor(Math.random() * 100000), // Random ID
            lat: centerLat + (Math.random() - 0.5) * 0.1,
            lng: centerLng + (Math.random() - 0.5) * 0.1,
            speed: Math.floor(Math.random() * 100),
            group_id: Math.floor(Math.random() * 5) + 1,
            video_index: Math.floor(Math.random() * 3) + 1,
            millis: new Date().getTime() - Math.random() * 10000000,
            frame_time: Math.random() * 100
        });
    }
    return points;
}

// --- API ROUTES ---

app.get('/api/first-point', (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] GET /api/first-point`);
    res.json({
        lat: 28.6129, 
        lng: 77.2295
    });
});

// 2. Map ke points ke liye API
app.get('/api/map-points', (req, res) => {
    const { minLat, maxLat, minLng, maxLng } = req.query;
    console.log(`[${new Date().toLocaleTimeString()}] GET /api/map-points`);
    
    const centerLat = (parseFloat(minLat) + parseFloat(maxLat)) / 2;
    const centerLng = (parseFloat(minLng) + parseFloat(maxLng)) / 2;
    const points = generateDummyPoints(centerLat, centerLng, 500);
    res.json(points);
});

// 3. Ek point ki details ke liye API
app.get('/api/point-details/:id', (req, res) => {
    const { id } = req.params;
    console.log(`[${new Date().toLocaleTimeString()}] GET /api/point-details/${id}`);
    
    res.json({
        id: parseInt(id), lat: 28.61, lng: 77.22,
        speed: 55, group_id: 3, video_index: 1,
        millis: new Date().getTime(), frame_time: 45.123
    });
});

// Server ko start karna
app.listen(PORT, () => {
    console.log(`Backend server is running and listening on http://localhost:${PORT}`);
    console.log('You can now start the frontend server (Live Server).');
});