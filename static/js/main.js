// main.js - handles drag/drop, upload, preview, theme, lang, history, chart
document.addEventListener("DOMContentLoaded", () => {
  const dragBox = document.getElementById("dragBox");
  const fileInput = document.getElementById("fileInput");
  const thumbs = document.getElementById("thumbs");
  const predictBtn = document.getElementById("predictBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loader = document.getElementById("loader");
  const resultArea = document.getElementById("resultArea");
  const resultLabel = document.getElementById("resultLabel");
  const probChartCtx = document.getElementById("probChart");
  const historyGrid = document.getElementById("historyGrid");
  const langToggle = document.getElementById("langToggle");
  const themeSwitch = document.getElementById("themeSwitch");
  const dragText = document.getElementById("dragText");

  let files = [];
  let chart = null;
  const classes = ["Anthracnose", "Fruit Fly", "Healthy Guava"];
  let currentLang = localStorage.getItem("lang") || "en";

  function loadHistory(){
    fetch("/api/history").then(r=>r.json()).then(data=>{
      historyGrid.innerHTML = "";
      data.history.forEach(item=>{
        const col = document.createElement("div");
        col.className = "col-6 col-md-4";
        col.innerHTML = `
          <div class="p-2">
            <img src="/uploads/${item.id}" class="history-thumb mb-2">
            <div><strong>${item.label}</strong></div>
            <small class="text-muted">${item.original_name}</small>
          </div>
        `;
        historyGrid.appendChild(col);
      })
    })
  }

  function showThumbs(){
    thumbs.innerHTML = "";
    files.forEach((f, idx) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";
      col.innerHTML = `
        <div>
          <img src="${URL.createObjectURL(f)}" class="thumb-img">
          <div class="mt-1 small text-muted">${f.name}</div>
        </div>`;
      thumbs.appendChild(col);
    });
  }

  dragBox.addEventListener("click", ()=> fileInput.click());
  dragBox.addEventListener("dragover", (e)=>{ e.preventDefault(); dragBox.classList.add("drag-over"); });
  dragBox.addEventListener("dragleave", ()=>{ dragBox.classList.remove("drag-over"); });
  dragBox.addEventListener("drop", (e)=> {
    e.preventDefault();
    dragBox.classList.remove("drag-over");
    const dropped = Array.from(e.dataTransfer.files);
    pushFiles(dropped);
  });

  fileInput.addEventListener("change", (e)=> pushFiles(Array.from(e.target.files)));

  function pushFiles(list){
    list.forEach(f=>{
      if (files.length >= 5) return;
      if (!["image/png","image/jpeg"].includes(f.type)) return;
      if (f.size > 5*1024*1024) return;
      files.push(f);
    });
    showThumbs();
  }

  clearBtn.addEventListener("click", ()=>{
    files = []; fileInput.value = ""; thumbs.innerHTML=""; resultArea.classList.add("d-none");
  });

  document.getElementById("uploadForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (files.length === 0) return alert("Select files first");
    loader.classList.remove("d-none");
    predictBtn.disabled = true;

    const form = new FormData();
    files.forEach(f=> form.append("files[]", f));

    const res = await fetch("/api/predict", { method:"POST", body: form });
    const data = await res.json();
    loader.classList.add("d-none");
    predictBtn.disabled = false;
    if (data.error) return alert(data.error);
    const r = data.results[0];
    displayResult(r);
    loadHistory();
  });

  function displayResult(r){
    resultArea.classList.remove("d-none");
    resultLabel.innerText = `${r.label}`;
    const probs = classes.map(c => r.probs[c] ?? 0);
    if (chart) chart.destroy();
    chart = new Chart(probChartCtx, {
      type: "bar",
      data: {
        labels: classes,
        datasets: [{ label: "Confidence", data: probs }]
      },
      options:{scales:{y:{beginAtZero:true, max:1}}}
    });
  }

  // theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  themeSwitch.checked = savedTheme === "dark";
  themeSwitch.addEventListener("change", ()=>{
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  function updatePageTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const text = t(key, currentLang);
      if (text) el.textContent = text;
    });
    document.documentElement.lang = currentLang === "bn" ? "bn" : "en";
  }

  // language (simple)
  function updateLangDisplay() {
    langToggle.textContent = currentLang === "en" ? "বাংলা" : "English";
    updatePageTranslations();
    localStorage.setItem("lang", currentLang);
  }
  langToggle.addEventListener("click", (e) => {
    e.preventDefault();
    currentLang = currentLang === "en" ? "bn" : "en";
    updateLangDisplay();
  });
  updateLangDisplay();

  // initial load
  loadHistory();

  // example button
  document.getElementById("exampleBtn").addEventListener("click", ()=>{
    alert("Use your own image. Example images not bundled.");
  });

  // modal predict
  const modalPredict = document.getElementById("modalPredict");
  if (modalPredict) modalPredict.addEventListener("click", ()=> document.getElementById("predictBtn").click());

  // year in footer
  document.getElementById("year").innerText = new Date().getFullYear();
});
