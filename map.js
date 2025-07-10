class OffsetPointsController {
  constructor(map) {
    this.map = map;
    this.offsetMarkers = L.layerGroup().addTo(map);
    this.isVisible = false;
    this.mode = "4-points";
    this.currentZoom = map.getZoom();
    this.zoomSensitivity = 1.0;
    this.baseOffsetPercentage = 0.5;

    map.on("zoomend", () => {
      this.currentZoom = map.getZoom();
      if (this.isVisible) this.refreshPoints();
    });
  }

  setMode(mode) {
    this.mode = mode;
    if (this.isVisible) this.refreshPoints();
  }

  toggleOffsetPoints() {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.refreshPoints();
    } else {
      this.offsetMarkers.clearLayers();
    }
  }

  clearAllPoints() {
    this.isVisible = false;
    this.offsetMarkers.clearLayers();
  }

  refreshPoints() {
    this.offsetMarkers.clearLayers();
    const zoomFactor = this.calculateZoomFactor();

    switch (this.mode) {
      case "4-points":
        this.createFourOffsetPoints(zoomFactor);
        break;
      case "polygon":
        const sides = parseInt(
          document.getElementById("polygonSides")?.value || 6
        );
        this.createPolygonPoints(sides, zoomFactor);
        break;
      case "grid":
        const rows = parseInt(document.getElementById("gridRows")?.value || 3);
        const cols = parseInt(document.getElementById("gridCols")?.value || 3);
        this.createGridPoints(rows, cols, zoomFactor);
        break;
      case "custom-bearings":
        const bearingsInput =
          document.getElementById("customBearings")?.value || "0,90,180,270";
        const bearings = bearingsInput
          .split(",")
          .map((b) => parseInt(b.trim()));
        this.createCustomPoints(bearings, zoomFactor);
        break;
    }
  }

  calculateZoomFactor() {
    // Normalize zoom level between 0.5 and 1.5 based on sensitivity
    const normalizedZoom = (this.currentZoom - 10) / (18 - 10);
    return 0.5 + normalizedZoom * this.zoomSensitivity;
  }

  createFourOffsetPoints(zoomFactor = 1) {
    const center = this.map.getCenter();
    const bounds = this.map.getBounds();
    const offsetPercentage = this.baseOffsetPercentage * zoomFactor;

    const directions = [
      { name: "North", bearing: 0 },
      { name: "East", bearing: 90 },
      { name: "South", bearing: 180 },
      { name: "West", bearing: 270 }
    ];

    directions.forEach((dir) => {
      const distance = this.calculateOffsetDistance(
        dir.bearing,
        bounds,
        center,
        offsetPercentage
      );
      const point = this.calculateDestination(
        center.lat,
        center.lng,
        dir.bearing,
        distance
      );
      this.addMarker(
        point,
        `
                <b>${dir.name} Offset Point</b><br>
                Coordinates: ${point.lat.toFixed(6)}, ${point.lng.toFixed(
          6
        )}<br>
                Distance: ${Math.round(distance)}m<br>
                Zoom: ${this.currentZoom} (×${zoomFactor.toFixed(2)})
            `,
        dir.name.toLowerCase()
      );
    });
  }

  createPolygonPoints(sides = 6, zoomFactor = 1) {
    const center = this.map.getCenter();
    const bounds = this.map.getBounds();
    const radius = this.calculateRadius(bounds, center) * 0.7 * zoomFactor;

    for (let i = 0; i < sides; i++) {
      const angle = (360 / sides) * i;
      const point = this.calculateDestination(
        center.lat,
        center.lng,
        angle,
        radius
      );
      this.addMarker(
        point,
        `
                <b>Polygon Vertex ${i + 1}</b><br>
                Coordinates: ${point.lat.toFixed(6)}, ${point.lng.toFixed(
          6
        )}<br>
                Radius: ${Math.round(radius)}m<br>
                Zoom: ${this.currentZoom} (×${zoomFactor.toFixed(2)})
            `,
        "polygon"
      );
    }
  }

  createGridPoints(rows, cols, zoomFactor = 1) {
    const bounds = this.map.getBounds();
    const latStep =
      ((bounds.getNorth() - bounds.getSouth()) / (rows + 1)) * zoomFactor;
    const lngStep =
      ((bounds.getEast() - bounds.getWest()) / (cols + 1)) * zoomFactor;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const lat = bounds.getSouth() + latStep * r;
        const lng = bounds.getWest() + lngStep * c;
        this.addMarker(
          [lat, lng],
          `
                    <b>Grid Point (${r},${c})</b><br>
                    Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                    Zoom: ${this.currentZoom} (×${zoomFactor.toFixed(2)})
                `,
          "grid"
        );
      }
    }
  }

  createCustomPoints(bearings, zoomFactor = 1) {
    const center = this.map.getCenter();
    const bounds = this.map.getBounds();
    const offsetPercentage = this.baseOffsetPercentage * zoomFactor;

    bearings.forEach((bearing) => {
      const distance = this.calculateOffsetDistance(
        bearing,
        bounds,
        center,
        offsetPercentage
      );
      const point = this.calculateDestination(
        center.lat,
        center.lng,
        bearing,
        distance
      );
      this.addMarker(
        point,
        `
                <b>Bearing ${bearing}°</b><br>
                Coordinates: ${point.lat.toFixed(6)}, ${point.lng.toFixed(
          6
        )}<br>
                Distance: ${Math.round(distance)}m<br>
                Zoom: ${this.currentZoom} (×${zoomFactor.toFixed(2)})
            `,
        "custom"
      );
    });
  }

  calculateOffsetDistance(bearing, bounds, center, percentage) {
    if ([45, 135, 225, 315].includes(bearing)) {
      const diagonalDist = this.map.distance(center, bounds.getNorthEast());
      return (diagonalDist * percentage) / Math.sqrt(2);
    }

    if (bearing % 90 === 0) {
      const isVertical = bearing % 180 === 0;
      const dist = isVertical
        ? this.map.distance(
            [bounds.getNorth(), center.lng],
            [bounds.getSouth(), center.lng]
          )
        : this.map.distance(
            [center.lat, bounds.getEast()],
            [center.lat, bounds.getWest()]
          );

      return (dist * percentage) / 2;
    }

    // For other bearings, use approximate calculation
    return (this.map.distance(center, bounds.getNorthEast()) * percentage) / 2;
  }

  calculateRadius(bounds, center) {
    return Math.min(
      this.map.distance(center, [bounds.getNorth(), center.lng]),
      this.map.distance(center, [center.lat, bounds.getEast()])
    );
  }

  addMarker(point, popupContent, type) {
    const colors = {
      north: "#FF5252",
      east: "#4CAF50",
      south: "#2196F3",
      west: "#FFC107",
      polygon: "#9C27B0",
      grid: "#607D8B",
      custom: "#795548"
    };

    const color = colors[type] || "#FF5722";

    L.circleMarker(point, {
      radius: 8,
      color: color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2
    })
      .bindPopup(popupContent)
      .addTo(this.offsetMarkers);
  }

  calculateDestination(lat, lng, bearing, distance) {
    const R = 6371e3;
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const bearingRad = (bearing * Math.PI) / 180;

    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(distance / R) +
        Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );

    const newLng =
      lngRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
        Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLat)
      );

    return {
      lat: (newLat * 180) / Math.PI,
      lng: (newLng * 180) / Math.PI
    };
  }
}
