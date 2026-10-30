
/* =========================================================
   AICRATIVE — SUPABASE + XKIRO CONNECTOR
   Browser -> Supabase Edge Function -> xKiro
   ========================================================= */

const AICRATIVE_SUPABASE_URL =
  "https://vlypxvhsbjwazjbqxehz.supabase.co/functions/v1/aicrative-ai";

const AICRATIVE_SUPABASE_PUBLIC_KEY =
  "sb_publishable_HVH5yiccWYJAzOEoIoNb5g_03bMlAoZ";

const AICRATIVE_XKIRO_MODEL = "qwen/qwen3.7-plus:free";

/* ---------- Helper status dan notifikasi ---------- */

function aicrativeSetStatus(message) {
  const status = document.getElementById("apiStatus");
  if (status) status.textContent = message;
}

function aicrativeNotify(message) {
  if (typeof window.notify === "function") {
    window.notify(message);
  }
}

/* ---------- Panggilan AI melalui Supabase ---------- */

async function aicrativeAskAI(prompt) {
  if (!AICRATIVE_SUPABASE_URL || !AICRATIVE_SUPABASE_PUBLIC_KEY) {
    throw new Error("URL atau publishable key Supabase belum diisi.");
  }

  let response;
  const userContent = typeof prompt === "string" ? prompt : JSON.stringify(prompt);

  try {
    response = await fetch(AICRATIVE_SUPABASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": AICRATIVE_SUPABASE_PUBLIC_KEY,
        "Authorization": `Bearer ${AICRATIVE_SUPABASE_PUBLIC_KEY}`
      },
      body: JSON.stringify({
        model: AICRATIVE_XKIRO_MODEL,
        messages: [
          {
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
  } catch (error) {
    console.error("AICRATIVE network error:", error);
    throw new Error(
      "Browser gagal menghubungi Supabase. Periksa domain, DNS, dan CORS. Detail: " +
      (error?.message || String(error))
    );
  }

  const raw = await response.text();
  let result;

  try {
    result = JSON.parse(raw);
  } catch {
    result = { error: raw || "Respons server kosong." };
  }

  if (!response.ok) {
    const detail =
      result?.error?.message ||
      result?.error ||
      result?.message ||
      result?.detail ||
      `HTTP ${response.status}`;

    throw new Error(
      `Supabase HTTP ${response.status}: ` +
      (typeof detail === "string" ? detail : JSON.stringify(detail))
    );
  }

  const content = result?.choices?.[0]?.message?.content;

  if (!content) {
    console.error("Respons Supabase tidak sesuai:", result);
    throw new Error(
      "Supabase merespons, tetapi teks AI tidak ditemukan. Periksa kode Edge Function."
    );
  }

  return typeof content === "string"
    ? content
    : JSON.stringify(content);
}

/* ---------- Kompatibilitas generator lama ---------- */

window.callGemini = async function (prompt) {
  return await aicrativeAskAI(prompt);
};

/* ---------- Simpan pengaturan sesi ---------- */

window.saveGeminiSettings = function () {
  const mode = document.getElementById("generationMode");

  if (mode) {
    try {
      sessionStorage.setItem(
        "aicrative_generation_mode",
        mode.value || "auto"
      );
    } catch (error) {
      console.warn("Pengaturan sesi tidak dapat disimpan:", error);
    }
  }

  aicrativeSetStatus(
    "Backend Supabase digunakan untuk menghubungkan AICRATIVE ke xKiro."
  );

  aicrativeNotify("Pengaturan backend disimpan untuk sesi ini.");
};

/* ---------- Tes koneksi Supabase dan xKiro ---------- */

window.testGeminiConnection = async function () {
  aicrativeSetStatus("Menguji koneksi Supabase ke xKiro...");

  try {
    const result = await aicrativeAskAI(
      "Balas hanya dengan teks: AICRATIVE CONNECTED"
    );

    aicrativeSetStatus("Koneksi berhasil: " + result.slice(0, 250));
    aicrativeNotify("Supabase dan xKiro berhasil merespons.");

    console.info("AICRATIVE connection successful:", result);
    return true;
  } catch (error) {
    const message = error?.message || String(error);

    aicrativeSetStatus("Koneksi gagal: " + message);
    aicrativeNotify("Tes koneksi gagal. Baca pesan pada panel koneksi.");

    console.error("AICRATIVE connection error:", error);
    return false;
  }
};

/* ---------- Bersihkan input API key lama ---------- */

window.clearGeminiSettings = function () {
  const input = document.getElementById("geminiKey");

  if (input) {
    input.value = "";
  }

  aicrativeSetStatus(
    "AICRATIVE menggunakan Supabase. Secret xKiro disimpan di Supabase Secrets."
  );
};

/* ---------- Label tampilan koneksi ---------- */

function aicrativeUpdateConnectionLabels() {
  document.querySelectorAll("h1, h2, h3, p, label, .tag").forEach((el) => {
    const text = el.textContent.trim();

    if (text === "Koneksi Gemini") {
      el.textContent = "Koneksi Supabase + xKiro";
    }

    if (text === "Gemini API Key") {
      el.textContent = "Backend API";
    }

    if (text === "GEMINI API") {
      el.textContent = "SUPABASE + XKIRO";
    }
  });

  const keyInput = document.getElementById("geminiKey");

  if (keyInput) {
    keyInput.placeholder = "Secret xKiro tersimpan di Supabase";
    keyInput.disabled = true;
    keyInput.value = "";

    const field = keyInput.closest(".field");
    if (field) field.style.display = "none";
  }

  const modelSelect = document.getElementById("geminiModel");

  if (modelSelect) {
    modelSelect.innerHTML = "";

    const option = document.createElement("option");
    option.value = AICRATIVE_XKIRO_MODEL;
    option.textContent = "Qwen3.7 Plus (Free) — xKiro";

    modelSelect.appendChild(option);
    modelSelect.disabled = true;
  }

  const modeSelect = document.getElementById("generationMode");

  if (modeSelect) {
    for (const option of modeSelect.options) {
      if (option.value === "auto") {
        option.textContent = "Otomatis (Supabase + xKiro)";
      } else if (option.value === "local") {
        option.textContent = "Template lokal saja";
      } else if (option.value === "gemini") {
        option.textContent = "Supabase + xKiro";
      }
    }
  }

  const status = document.getElementById("apiStatus");

  if (status && !status.textContent.includes("Koneksi berhasil")) {
    status.textContent =
      "Backend Supabase siap. Klik Tes koneksi API untuk menguji.";
  }
}

/* ---------- Generator Story & Scene Studio ---------- */

window.confirmGenerate = async function () {
  if (typeof window.closeLanguageModal === "function") {
    window.closeLanguageModal();
  }

  const mode =
    document.getElementById("generationMode")?.value || "auto";

  if (mode === "local") {
    if (typeof window.generateStory === "function") {
      window.generateStory(window.pendingIdea);
    } else {
      throw new Error("Fungsi generator lokal tidak ditemukan.");
    }

    if (typeof window.updateDashboardStats === "function") {
      window.updateDashboardStats();
    }

    return;
  }

  const storyGenerator =
    typeof window.generateStoryWithGemini === "function"
      ? window.generateStoryWithGemini
      : typeof window.generateStoryWithOpenAI === "function"
      ? window.generateStoryWithOpenAI
      : null;

  if (!storyGenerator) {
    if (typeof window.generateStory === "function") {
      window.generateStory(window.pendingIdea);
      if (typeof window.updateDashboardStats === "function") {
        window.updateDashboardStats();
      }
      return;
    }
    alert(
      "Fungsi Story & Scene Studio tidak ditemukan. Periksa script utama index.html."
    );
    return;
  }

  const ok = await storyGenerator(window.pendingIdea);

  if (!ok && mode === "auto") {
    aicrativeNotify("AI tidak tersedia. Menggunakan generator lokal.");

    if (typeof window.generateStory === "function") {
      window.generateStory(window.pendingIdea);
    }

    if (typeof window.updateDashboardStats === "function") {
      window.updateDashboardStats();
    }
  }
};

window.testOpenAIConnection = window.testGeminiConnection;
window.saveOpenAISettings = window.saveGeminiSettings;
window.callOpenAI = window.callGemini;

/* ---------- Inisialisasi ---------- */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    aicrativeUpdateConnectionLabels
  );
} else {
  aicrativeUpdateConnectionLabels();
}
