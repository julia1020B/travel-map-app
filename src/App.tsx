import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const STORAGE_KEY = "travel_places_v3";
const WS_URL = "wss://example.com/ws/travel";

const DB_NAME = "travel_db";
const DB_STORE = "images";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveImage(id, dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadImage(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function deleteImageDB(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const activeIcon = L.divIcon({
  className: "active-marker",
  html: `<div style=\"width:22px;height:22px;background:#ff3b30;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(255,59,48,0.8)\"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function tryLoadPlaces() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 🔗 link parser
const urlRegex = /(https?:\/\/[^\s]+)/g;

function renderNoteWithLinks(text) {
  if (!text) return null;

  return text.split(urlRegex).map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function App() {
  const mapRef = useRef(null);
  const mapDivRef = useRef(null);
  const wsRef = useRef(null);

  const [places, setPlaces] = useState(() => tryLoadPlaces());
  const [activeId, setActiveId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPlanOnMap, setShowPlanOnMap] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [imageCache, setImageCache] = useState({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);

  useEffect(() => {
    try {
      wsRef.current = new WebSocket(WS_URL);
    } catch {}
  }, []);

  useEffect(() => {
    async function loadAll() {
      const cache = {};
      for (const p of places) {
        for (const id of p.images || []) {
          if (!cache[id]) cache[id] = await loadImage(id);
        }
      }
      setImageCache(cache);
    }
    loadAll();
  }, [places]);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    mapRef.current = L.map(mapDivRef.current).setView([42.5, 19.3], 8);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(mapRef.current);

    mapRef.current.on("click", (e) => {
      const newPlace = {
        id: Date.now(),
        name: "Nowe miejsce",
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        note: "",
        images: [],
      };
      setPlaces(p => [...p, newPlace]);
      setActiveId(newPlace.id);
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current || !showPlanOnMap || places.length === 0) return;

    const bounds = L.latLngBounds(places.map(p => [p.lat, p.lng]));
    mapRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, [showPlanOnMap, places]);

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.Marker) mapRef.current.removeLayer(layer);
    });

    places.forEach(place => {
      const imgs = (place.images || []).map(id => imageCache[id]).filter(Boolean);

      const imgHtml = imgs.map(src =>
        `<img src=\"${src}\" style=\"width:40px;height:40px;object-fit:cover;border-radius:4px;margin-right:3px\"/>`
      ).join("");

      const marker = L.marker([place.lat, place.lng], {
        icon: place.id === activeId ? activeIcon : defaultIcon,
        draggable: true,
      }).addTo(mapRef.current);

      marker.bindTooltip(
        `<b>${place.name}</b><br/>${place.note || ""}<br/>${imgHtml}`,
        { direction: "top" }
      );

      marker.on("click", () => setActiveId(place.id));

      marker.on("dragend", e => {
        const pos = e.target.getLatLng();
        setPlaces(prev => prev.map(p =>
          p.id === place.id ? { ...p, lat: pos.lat, lng: pos.lng } : p
        ));
      });
    });
  }, [places, activeId, imageCache]);

  const updatePlace = (id, field, value) => {
    setPlaces(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deletePlace = (id) => {
    setPlaces(prev => prev.filter(p => p.id !== id));
    setActiveId(null);
  };

  return (
    <div className="w-screen h-screen relative overflow-hidden">

      <div ref={mapDivRef} className="absolute inset-0" />

      <div className={`absolute left-0 top-0 h-full bg-white shadow-lg z-[2000] transition-all ${sidebarOpen ? "w-80" : "w-10"}`}>
        <div className="p-2 flex justify-between border-b">
          {sidebarOpen && <b>Plan podróży</b>}

          <div className="flex gap-2">
            <button onClick={() => setShowPlanOnMap(v => !v)}>📍</button>
            <button onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen ? "⟵" : "⟶"}
            </button>
          </div>
        </div>

        {sidebarOpen && places.map(p => (
          <div key={p.id} className="p-2 border-b">

            <div className="flex justify-between items-center">
              {activeId === p.id ? (
                <input
                  value={p.name}
                  onChange={e => updatePlace(p.id, "name", e.target.value)}
                />
              ) : (
                <b onClick={() => setActiveId(p.id)}>{p.name}</b>
              )}

              <button onClick={() => deletePlace(p.id)}>🗑</button>
            </div>

            {/* NOTE WITH LINKS */}
            {activeId === p.id ? (
              <textarea
                value={p.note}
                onChange={e => updatePlace(p.id, "note", e.target.value)}
              />
            ) : (
              p.note && (
                <div className="text-sm text-gray-600 mt-1">
                  {renderNoteWithLinks(p.note)}
                </div>
              )
            )}

            {(p.images || []).length > 0 && (
              <div className="grid grid-cols-2 gap-1 mt-2">
                {(p.images || []).map(id => (
                  <div key={id} className="relative">
                    <img
                      src={imageCache[id]}
                      className="w-full h-20 object-cover cursor-pointer"
                      onClick={() => setLightboxImg(imageCache[id])}
                    />
                  </div>
                ))}
              </div>
            )}

          </div>
        ))}
      </div>

      {lightboxImg && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999]" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-[90%] max-h-[90%]" />
        </div>
      )}

      <style>{`.active-marker{background:transparent;border:none;}`}</style>
    </div>
  );
}
