
const DB_NAME = "YatraGenNativeJS";
const DB_VERSION = 1;
let dbInstance = null;
let currentUser = null;
let allTrips = [];
let currentGeneratedItinerary = null;
let activeHistoryTab = "upcoming";

function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      
      if (!db.objectStoreNames.contains("auth_session")) {
        db.createObjectStore("auth_session", { keyPath: "id" });
      }

      
      if (!db.objectStoreNames.contains("trips_store")) {
        db.createObjectStore("trips_store", { keyPath: "id" });
      }
    };

    request.onsuccess = function (event) {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = function (event) {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };
  });
}

function dbSaveTrip(tripObject) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["trips_store"], "readwrite");
    const store = tx.objectStore("trips_store");
    const req = store.put(tripObject);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAllTrips() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["trips_store"], "readonly");
    const store = tx.objectStore("trips_store");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDeleteTrip(id) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["trips_store"], "readwrite");
    const store = tx.objectStore("trips_store");
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function dbSaveUser(userObj) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["auth_session"], "readwrite");
    const store = tx.objectStore("auth_session");
    const req = store.put({ id: "active_user", ...userObj });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function dbGetUser() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["auth_session"], "readonly");
    const store = tx.objectStore("auth_session");
    const req = store.get("active_user");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function dbClearUser() {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(["auth_session"], "readwrite");
    const store = tx.objectStore("auth_session");
    const req = store.delete("active_user");
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}


const curatedLocations = {
  agartala: [
    {
      morning: { place: "Ujjayanta Palace (Rajbari)", desc: "Former royal palace featuring neoclassical architecture and the Tripura Government State Museum halls." },
      afternoon: { place: "Hawkers Corner Market & Jagannath Mandir", desc: "Local handloom crafts and regional street food followed by visits to historic temple grounds." },
      evening: { place: "Heritage Park Agartala", desc: "Walking trail featuring miniature models of Tripura's principal cultural and natural landmarks." }
    },
    {
      morning: { place: "Neermahal Water Palace (Rudrasagar Lake)", desc: "Lake palace showcasing Mughal and Hindu architectural fusion, accessible via boat transfer." },
      afternoon: { place: "Durgabari Tea Estate", desc: "Expansive green tea plantations on the city outskirts with tea processing observation." },
      evening: { place: "Battala Bazaar", desc: "Regional commercial hub ideal for authentic bamboo handicraft shopping and casual evening dining." }
    },
    {
      morning: { place: "Sepahijala Wildlife Sanctuary", desc: "Protected bio-reserve habitat for the endangered Phayre's leaf monkey and migratory birds." },
      afternoon: { place: "Tripura Sundari Temple (Udaipur)", desc: "One of the 51 sacred Shakti Peethas located 55 km south of Agartala." },
      evening: { place: "Kalyan Sagar Lake", desc: "Tranquil lake surrounding the temple complex, home to large tortoises and scenic banks." }
    }
  ],
  tokyo: [
    {
      morning: { place: "Senso-ji Temple & Nakamise-dori", desc: "Oldest Buddhist temple in Tokyo with traditional market stalls." },
      afternoon: { place: "Ueno Park & Tokyo National Museum", desc: "Extensive public cultural grounds housing classical Japanese art collections." },
      evening: { place: "Akihabara District", desc: "Center of consumer electronics and Japanese pop culture." }
    },
    {
      morning: { place: "Meiji Jingu Shrine & Yoyogi Park", desc: "Shinto shrine set within an urban forest preserve." },
      afternoon: { place: "Shibuya Crossing & Harajuku", desc: "World-famous pedestrian intersection and youth fashion boulevard." },
      evening: { place: "Shinjuku Observation Decks", desc: "Panoramic evening views from the Tokyo Metropolitan Government Building." }
    }
  ]
};

function buildItinerary(destinationRaw, daysCount, budget, pace) {
  const cleanKey = destinationRaw.trim().toLowerCase();
  const matchedKey = Object.keys(curatedLocations).find(k => cleanKey.includes(k));
  const budgetPrefix = budget === "Premium" ? "Private guided tour of " : budget === "Economy" ? "Public transit connection to " : "Standard excursion to ";

  const schedule = [];

  for (let i = 1; i <= daysCount; i++) {
    if (matchedKey && curatedLocations[matchedKey][i - 1]) {
      const item = curatedLocations[matchedKey][i - 1];
      schedule.push({
        day: i,
        morning: { place: item.morning.place, desc: item.morning.desc },
        afternoon: { place: item.afternoon.place, desc: item.afternoon.desc },
        evening: { place: item.evening.place, desc: item.evening.desc }
      });
    } else {
      const fallbacks = [
        {
          m: `Central Historic Quarter of ${destinationRaw}`,
          mD: `${budgetPrefix}the main public square, historical monuments, and civic exhibits.`,
          a: `${destinationRaw} Botanical Reserve & Heritage Trail`,
          aD: `Walking path highlighting regional landscapes, flora, and local architecture.`,
          e: `${destinationRaw} Artisan Market & Cultural District`,
          eD: `Evening walk through regional merchant avenues and dining establishments.`
        },
        {
          m: `National Museum of ${destinationRaw}`,
          mD: `Curated collections highlighting provincial culture and antiquity.`,
          a: `${destinationRaw} Riverside Promenade or Valley Overlook`,
          aD: `Scenic vantage point offering panorama views across the territory.`,
          e: `Traditional Gastronomy Quarter in ${destinationRaw}`,
          eD: `Local cuisine suited to a ${budget.toLowerCase()} budget and ${pace.toLowerCase()} pace.`
        },
        {
          m: `Historic Fortress or Citadel Grounds near ${destinationRaw}`,
          mD: `Exploration of defensive architectural fortifications and observation towers.`,
          a: `Suburban Countryside & Agricultural Preserve`,
          aD: `Guided tour of regional craft production and agricultural centers.`,
          e: `Civic Center & Performing Arts Pavilion`,
          eD: `Open-air musical pavilion and public garden promenades.`
        }
      ];

      const pick = fallbacks[(i - 1) % fallbacks.length];
      schedule.push({
        day: i,
        morning: { place: pick.m, desc: pick.mD },
        afternoon: { place: pick.a, desc: pick.aD },
        evening: { place: pick.e, desc: pick.eD }
      });
    }
  }

  return {
    id: "trip_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    destination: destinationRaw.trim(),
    duration: daysCount,
    budget: budget,
    pace: pace,
    createdDate: new Date(),
    schedule: schedule,
    photos: [] }
  };



function switchView(viewName) {
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-links a").forEach(a => a.classList.remove("active"));

  if (viewName === "generate") {
    document.getElementById("view-generate").classList.add("active");
    document.getElementById("nav-gen").classList.add("active");
  } else {
    document.getElementById("view-history").classList.add("active");
    document.getElementById("nav-trips").classList.add("active");
    renderTripsView();
  }
}

function switchTripTab(tabName) {
  activeHistoryTab = tabName;
  document.getElementById("tabUpcomingBtn").classList.toggle("active", tabName === "upcoming");
  document.getElementById("tabPastBtn").classList.toggle("active", tabName === "past");
  renderTripsView();
}

function renderAuthUI() {
  const container = document.getElementById("authSection");
  if (currentUser) {
    container.innerHTML = `
      <span>Signed in as <strong>${escapeHtml(currentUser.username)}</strong></span>
      <button class="btn btn-outline btn-small" onclick="handleLogout()">Sign Out</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-outline btn-small" onclick="openLoginModal()">Sign In</button>
    `;
  }
}

function openLoginModal() {
  document.getElementById("loginModal").classList.add("active");
}

function closeLoginModal() {
  document.getElementById("loginModal").classList.remove("active");
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!username || !email) return;

  // Pure JavaScript Object
  currentUser = { username: username, email: email, signedInAt: new Date() };
  await dbSaveUser(currentUser);

  closeLoginModal();
  renderAuthUI();
}

async function handleLogout() {
  currentUser = null;
  await dbClearUser();
  renderAuthUI();
}

function handleGenerate(event) {
  event.preventDefault();

  const dest = document.getElementById("destination").value.trim();
  const duration = parseInt(document.getElementById("duration").value, 10);
  const budget = document.getElementById("budget").value;
  const pace = document.getElementById("pace").value;

  if (!dest) return;

  currentGeneratedItinerary = buildItinerary(dest, duration, budget, pace);
  renderGeneratedItinerary(currentGeneratedItinerary);
}

function renderGeneratedItinerary(data) {
  const wrapper = document.getElementById("resultsWrapper");
  const title = document.getElementById("resultTitle");
  const meta = document.getElementById("resultMeta");
  const daysList = document.getElementById("daysList");

  title.textContent = `Itinerary for ${data.destination}`;
  meta.innerHTML = `
    <span class="badge badge-blue">${data.duration} Day(s)</span>
    <span class="badge badge-green">${data.budget} Tier</span>
    <span class="badge badge-yellow">${data.pace}</span>
    <span class="badge badge-pink">Verified Route</span>
  `;

  let html = "";
  data.schedule.forEach(day => {
    html += `
      <div class="day-container">
        <div class="day-title">Day ${day.day}</div>
        <table class="slot-table">
          <tr>
            <th>Morning</th>
            <td>
              <div class="slot-place">${escapeHtml(day.morning.place)}</div>
              <div class="slot-desc">${escapeHtml(day.morning.desc)}</div>
            </td>
          </tr>
          <tr>
            <th>Afternoon</th>
            <td>
              <div class="slot-place">${escapeHtml(day.afternoon.place)}</div>
              <div class="slot-desc">${escapeHtml(day.afternoon.desc)}</div>
            </td>
          </tr>
          <tr>
            <th>Evening</th>
            <td>
              <div class="slot-place">${escapeHtml(day.evening.place)}</div>
              <div class="slot-desc">${escapeHtml(day.evening.desc)}</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  });

  daysList.innerHTML = html;
  wrapper.style.display = "block";
  wrapper.scrollIntoView({ behavior: "smooth" });
}

async function saveCurrentItinerary(status) {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  if (!currentGeneratedItinerary) return;

  const newTrip = {
    ...currentGeneratedItinerary,
    id: "trip_" + Date.now(),
    status: status,
    savedAt: new Date()
  };

  await dbSaveTrip(newTrip);
  allTrips = await dbGetAllTrips();
  updateTripCounters();

  alert(`Itinerary successfully saved to ${status === "upcoming" ? "Upcoming Trips" : "Past Trips"}.`);
}

function updateTripCounters() {
  const upCount = allTrips.filter(t => t.status === "upcoming").length;
  const pastCount = allTrips.filter(t => t.status === "past").length;
  document.getElementById("upcomingCount").textContent = upCount;
  document.getElementById("pastCount").textContent = pastCount;
}

function renderTripsView() {
  updateTripCounters();
  const container = document.getElementById("tripsContainer");
  const filtered = allTrips.filter(t => t.status === activeHistoryTab);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No ${activeHistoryTab} trip records found in your archive.</p>
        <p style="margin-top: 8px; font-size: 0.85rem;">Use the Plan Itinerary tool to create and record new journeys.</p>
      </div>
    `;
    return;
  }

  let html = "";
  filtered.forEach(trip => {
    const formattedDate = trip.savedAt instanceof Date 
      ? trip.savedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "Recorded Date";

    html += `
      <div class="trip-card">
        <div class="trip-header">
          <div>
            <div class="trip-location">${escapeHtml(trip.destination)}</div>
            <div class="trip-meta">
              Duration: ${trip.duration} Day(s) &bull; Budget: ${trip.budget} &bull; Recorded: ${formattedDate}
            </div>
          </div>
          <div class="trip-actions">
            ${
              trip.status === "upcoming"
                ? `<button class="btn btn-outline btn-small" onclick="toggleTripStatus('${trip.id}', 'past')">Mark Completed</button>`
                : `<button class="btn btn-outline btn-small" onclick="toggleTripStatus('${trip.id}', 'upcoming')">Move to Upcoming</button>`
            }
            <button class="btn btn-outline btn-small" onclick="removeTrip('${trip.id}')" style="color: #b91c1c;">Remove</button>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          ${trip.schedule.map(d => `
            <div style="font-size: 0.88rem; margin-bottom: 6px;">
              <strong style="color: var(--primary-green);">Day ${d.day}:</strong>
              ${escapeHtml(d.morning.place)}, ${escapeHtml(d.afternoon.place)}, and ${escapeHtml(d.evening.place)}.
            </div>
          `).join("")}
        </div>

        <div class="memory-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="memory-heading">Trip Memory Photos (${trip.photos ? trip.photos.length : 0})</span>
            <label class="upload-input-label">
              Upload Photo
              <input type="file" class="file-input" accept="image/*" onchange="handleNativePhotoUpload(event, '${trip.id}')" />
            </label>
          </div>

          <div class="memory-grid" id="gallery-${trip.id}">
            ${
              trip.photos && trip.photos.length > 0
                ? trip.photos.map((blob) => {
                    const blobUrl = URL.createObjectURL(blob);
                    return `<img src="${blobUrl}" class="memory-thumb" alt="Trip photograph" />`;
                  }).join("")
                : `<p style="font-size: 0.8rem; color: var(--slate-600); grid-column: 1 / -1;">No memory photos uploaded yet.</p>`
            }
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function toggleTripStatus(id, newStatus) {
  const trip = allTrips.find(t => t.id === id);
  if (trip) {
    trip.status = newStatus;
    await dbSaveTrip(trip);
    allTrips = await dbGetAllTrips();
    renderTripsView();
  }
}

async function removeTrip(id) {
  if (confirm("Are you sure you want to delete this trip record?")) {
    await dbDeleteTrip(id);
    allTrips = await dbGetAllTrips();
    renderTripsView();
  }
}

async function handleNativePhotoUpload(event, tripId) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  const trip = allTrips.find(t => t.id === tripId);
  if (trip) {
    if (!trip.photos) trip.photos = [];
    trip.photos.push(file);

    await dbSaveTrip(trip);
    allTrips = await dbGetAllTrips();
    renderTripsView();
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}


document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initDatabase();
    currentUser = await dbGetUser();
    allTrips = await dbGetAllTrips();

    renderAuthUI();
    updateTripCounters();

   
    const destInput = document.getElementById("destination");
    if (destInput) {
      destInput.value = "Agartala";
    }
  } catch (err) {
    console.error("Initialization failure:", err);
  }
});