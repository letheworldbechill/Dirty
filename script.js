/***********************************************************
 *  Script für NavigoOrdnung - Erweiterte Version
 *  
 *  Enthält:
 *    - Gitteraufbau (aktive/inaktive Zellen + clean/dirty)
 *    - Bearbeitungsmodus vs. Interaktionsmodus
 *    - Zoom & Rotation
 *    - Settings-Modal (Gittergröße, täglicher Reset, Räume)
 *    - Raumverwaltung (Erstellen, Anzeigen, Löschen)
 *    - Lokale Speicherung als JSON
 ***********************************************************/

document.addEventListener('DOMContentLoaded', () => {

  /***********************************************************
   * 1) Globale Variablen & DOM-Elemente
   ***********************************************************/
  const gridContainer = document.getElementById('grid-container');
  const modeIndicator = document.getElementById('mode-indicator');
  const modeToggleBtn = document.getElementById('mode-toggle');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const rotateBtn = document.getElementById('rotate-btn');
  const gridWrapper = document.getElementById('grid-wrapper');
  
  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const closeModal = document.getElementById('close-modal');
  const saveSettingsBtn = document.getElementById('save-settings');
  
  const gridRowsInput = document.getElementById('grid-rows');
  const gridColsInput = document.getElementById('grid-cols');
  const applyGridSizeBtn = document.getElementById('apply-grid-size');
  
  const dailyResetTimeInput = document.getElementById('daily-reset-time');
  const saveResetTimeBtn = document.getElementById('save-reset-time');
  
  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Räume
  const roomsListEl = document.getElementById('rooms-list');
  const createRoomBtn = document.getElementById('create-room-btn');
  const newRoomNameInput = document.getElementById('new-room-name');
  
  // Aktueller Modus: 'interaction' oder 'edit'
  let currentMode = 'interaction';
  
  // Zoom & Rotation
  let currentScale = 1.0;
  let currentRotation = 0;
  
  // Datenstruktur zum Speichern (alles in einem JSON)
  // Wir laden initial aus localStorage oder nehmen Defaults
  let appData = {
    gridRows: 20,
    gridCols: 20,
    dailyResetHour: 2,
    apartmentLayout: [], // [ [true/false], ... ]
    cellStates: [],       // [ [ { status: 'dirty'|'clean', selected: false }, ... ], ... ]
    rooms: []             // [ {id, name, cells: [ {r, c}, ... ]}, ... ]
  };

  /***********************************************************
   * 2) Aus localStorage laden und initialisieren
   ***********************************************************/
  loadFromLocalStorage();
  // Gittergrößen ins DOM eintragen
  gridRowsInput.value = appData.gridRows;
  gridColsInput.value = appData.gridCols;
  dailyResetTimeInput.value = appData.dailyResetHour;
  
  // Falls arrays nicht belegt, Standard anlegen
  if (!appData.apartmentLayout.length) {
    initDefaultLayout(appData.gridRows, appData.gridCols);
  }
  if (!appData.cellStates.length) {
    initDefaultCellStates(appData.gridRows, appData.gridCols);
  }

  // Gitter aufbauen
  buildGrid();
  renderRoomsList();
  updateTransform();
  scheduleDailyReset();

  /***********************************************************
   * 3) Funktionen für Gitter und Layout
   ***********************************************************/

  function initDefaultLayout(rows, cols) {
    appData.apartmentLayout = Array.from({ length: rows }, () => 
      Array(cols).fill(true)
    );
  }

  function initDefaultCellStates(rows, cols) {
    appData.cellStates = Array.from({ length: rows }, () => 
      Array(cols).fill({ status: 'dirty', selected: false })
    );
  }

  function buildGrid() {
    // CSS-Grid-Einstellungen mit festen Zellgrößen
    gridContainer.style.gridTemplateRows = `repeat(${appData.gridRows}, 30px)`;
    gridContainer.style.gridTemplateColumns = `repeat(${appData.gridCols}, 30px)`;
    
    // Grid leeren
    gridContainer.innerHTML = '';
    
    // Zellen erzeugen
    for (let r = 0; r < appData.gridRows; r++) {
      for (let c = 0; c < appData.gridCols; c++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        
        // Aktiv oder inaktiv?
        if (!appData.apartmentLayout[r][c]) {
          cell.classList.add('inactive');
          // Keine Click-Events
        } else {
          // dirty oder clean?
          if (appData.cellStates[r][c].status === 'clean') {
            cell.classList.add('clean');
          } else {
            cell.classList.add('active');
          }
          
          // Selektiert?
          if (appData.cellStates[r][c].selected) {
            cell.classList.add('selected');
          }
          
          // Klick-Event - abhängig vom Modus
          cell.addEventListener('click', () => {
            if (currentMode === 'interaction') {
              toggleCellState(r, c, cell);
            } else {
              toggleSelection(r, c, cell);
            }
          });
        }
        
        gridContainer.appendChild(cell);
      }
    }
  }

  // clean <-> dirty
  function toggleCellState(row, col, cellEl) {
    if (appData.cellStates[row][col].status === 'dirty') {
      appData.cellStates[row][col].status = 'clean';
      cellEl.classList.remove('active');
      cellEl.classList.add('clean');
    } else {
      appData.cellStates[row][col].status = 'dirty';
      cellEl.classList.remove('clean');
      cellEl.classList.add('active');
    }
    saveToLocalStorage();
  }

  // Selektieren / Deselektieren für Raum-Erstellung
  function toggleSelection(row, col, cellEl) {
    appData.cellStates[row][col].selected = !appData.cellStates[row][col].selected;
    if (appData.cellStates[row][col].selected) {
      cellEl.classList.add('selected');
    } else {
      cellEl.classList.remove('selected');
    }
    saveToLocalStorage();
  }

  /***********************************************************
   * 4) Modus-Umschaltung
   ***********************************************************/
  modeToggleBtn.addEventListener('click', () => {
    if (currentMode === 'interaction') {
      currentMode = 'edit';
      modeToggleBtn.textContent = 'Modus: Bearbeiten';
      modeIndicator.textContent = 'Bearbeitungsmodus';
    } else {
      currentMode = 'interaction';
      modeToggleBtn.textContent = 'Modus: Interaktion';
      modeIndicator.textContent = 'Interaktionsmodus';
    }
  });

  /***********************************************************
   * 5) Zoom & Rotation
   ***********************************************************/
  zoomInBtn.addEventListener('click', () => {
    currentScale += 0.1;
    updateTransform();
  });
  zoomOutBtn.addEventListener('click', () => {
    currentScale = Math.max(0.1, currentScale - 0.1);
    updateTransform();
  });
  rotateBtn.addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    updateTransform();
  });

  function updateTransform() {
    gridWrapper.style.transform = `scale(${currentScale}) rotate(${currentRotation}deg)`;
  }

  /***********************************************************
   * 6) Modal & Einstellungen
   ***********************************************************/
  settingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    // Zeige standardmäßig den "Gitter"-Tab
    openTab('gridTab');
  });
  closeModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  // Tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      openTab(btn.dataset.tab);
    });
  });

  function openTab(tabId) {
    tabContents.forEach(tc => {
      if (tc.id === tabId) tc.classList.add('active');
      else tc.classList.remove('active');
    });
  }

  // Gitter-Größe anwenden
  applyGridSizeBtn.addEventListener('click', () => {
    const newRows = parseInt(gridRowsInput.value, 10);
    const newCols = parseInt(gridColsInput.value, 10);
    if (isNaN(newRows) || newRows < 1 || newRows > 50) {
      alert('Ungültige Zeilenzahl (1-50).');
      return;
    }
    if (isNaN(newCols) || newCols < 1 || newCols > 50) {
      alert('Ungültige Spaltenzahl (1-50).');
      return;
    }
    // Nur wenn sich tatsächlich was ändert
    if (newRows !== appData.gridRows || newCols !== appData.gridCols) {
      appData.gridRows = newRows;
      appData.gridCols = newCols;
      initDefaultLayout(newRows, newCols);
      initDefaultCellStates(newRows, newCols);
      appData.rooms = []; // Räume zurücksetzen, da Layout geändert wurde
      buildGrid();
      renderRoomsList();
      updateTransform();
      saveToLocalStorage();
      alert('Gittergröße geändert. Räume wurden zurückgesetzt.');
    }
  });

  // Täglichen Reset speichern
  saveResetTimeBtn.addEventListener('click', () => {
    const hour = parseInt(dailyResetTimeInput.value, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      alert('Bitte eine Stunde zwischen 0 und 23 angeben.');
      return;
    }
    appData.dailyResetHour = hour;
    saveToLocalStorage();
    alert('Tägliche Reset-Zeit gespeichert: ' + hour + ':00 Uhr');
  });

  // "Einstellungen speichern" (und Modal schließen)
  saveSettingsBtn.addEventListener('click', () => {
    saveToLocalStorage();
    settingsModal.style.display = 'none';
    alert('Einstellungen gespeichert.');
  });

  /***********************************************************
   * 7) Räume erstellen und verwalten
   ***********************************************************/
  createRoomBtn.addEventListener('click', () => {
    const name = newRoomNameInput.value.trim();
    if (!name) {
      alert('Bitte einen Raumnamen eingeben.');
      return;
    }
    // Erstelle Liste aller Zellen, die ausgewählt sind
    let selectedCells = [];
    for (let r = 0; r < appData.gridRows; r++) {
      for (let c = 0; c < appData.gridCols; c++) {
        if (appData.apartmentLayout[r][c] && appData.cellStates[r][c].selected) {
          selectedCells.push({r, c});
        }
      }
    }
    if (selectedCells.length === 0) {
      alert('Keine ausgewählten Zellen zum Raum hinzugefügt.');
      return;
    }
    
    const newRoom = {
      id: Date.now(), // einfache ID
      name,
      cells: selectedCells
    };
    appData.rooms.push(newRoom);
    newRoomNameInput.value = '';
    
    // Entferne die 'selected' Status
    selectedCells.forEach(cell => {
      appData.cellStates[cell.r][cell.c].selected = false;
    });
    
    buildGrid(); // Aktualisiere das Grid, um 'selected' zurückzusetzen
    renderRoomsList();
    saveToLocalStorage();
    alert(`Raum "${name}" erstellt!`);
  });

  function renderRoomsList() {
    roomsListEl.innerHTML = '';
    if (!appData.rooms.length) {
      roomsListEl.innerHTML = '<p>Keine Räume definiert.</p>';
      return;
    }
    appData.rooms.forEach(room => {
      const div = document.createElement('div');
      div.classList.add('room-item');
      
      const label = document.createElement('span');
      label.textContent = room.name;
      
      const btnContainer = document.createElement('span');
      
      // Button "Highlight"
      const highlightBtn = document.createElement('button');
      highlightBtn.textContent = 'Markieren';
      highlightBtn.addEventListener('click', () => {
        highlightRoom(room);
      });
      
      // Button "Löschen"
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Löschen';
      deleteBtn.addEventListener('click', () => {
        deleteRoom(room.id);
      });
      
      btnContainer.appendChild(highlightBtn);
      btnContainer.appendChild(deleteBtn);
      
      div.appendChild(label);
      div.appendChild(btnContainer);
      roomsListEl.appendChild(div);
    });
  }

  // Raum hervorheben
  function highlightRoom(room) {
    // Hervorheben durch kurzzeitiges Ändern der Hintergrundfarbe
    const coordsSet = new Set(room.cells.map(c => `${c.r},${c.c}`));
    
    // Iteriere über alle Grid-Kinder
    [...gridContainer.children].forEach((cellEl, index) => {
      const r = Math.floor(index / appData.gridCols);
      const c = index % appData.gridCols;
      if (coordsSet.has(`${r},${c}`)) {
        cellEl.style.transition = 'background-color 0.5s';
        cellEl.style.backgroundColor = 'yellow';
        // Nach 1 Sek wiederherstellen
        setTimeout(() => {
          if (!appData.apartmentLayout[r][c]) {
            cellEl.className = 'cell inactive';
          } else {
            // dirty oder clean?
            cellEl.className = 'cell ' + 
              (appData.cellStates[r][c].status === 'clean' ? 'clean' : 'active');
          }
        }, 1000);
      }
    });
  }

  // Raum löschen
  function deleteRoom(roomId) {
    if (!confirm('Möchtest du diesen Raum wirklich löschen?')) return;
    appData.rooms = appData.rooms.filter(r => r.id !== roomId);
    renderRoomsList();
    saveToLocalStorage();
  }

  // Initial einmal Liste rendern
  renderRoomsList();

  /***********************************************************
   * 8) Tägliches Zurücksetzen
   ***********************************************************/
  function scheduleDailyReset() {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setHours(appData.dailyResetHour, 0, 0, 0);
    
    if (now >= nextReset) {
      // Morgen
      nextReset.setDate(nextReset.getDate() + 1);
    }
    const diff = nextReset - now;
    setTimeout(() => {
      resetAllCells();
      scheduleDailyReset(); // Danach neu ansetzen
    }, diff);
  }

  // Reset-Funktion
  function resetAllCells() {
    for (let r = 0; r < appData.gridRows; r++) {
      for (let c = 0; c < appData.gridCols; c++) {
        if (appData.apartmentLayout[r][c]) {
          appData.cellStates[r][c].status = 'dirty';
        }
      }
    }
    buildGrid();
    saveToLocalStorage();
    console.log('Täglicher Reset ausgeführt.');
  }

  /***********************************************************
   * 9) Lokale Speicherung
   ***********************************************************/
  function loadFromLocalStorage() {
    const saved = localStorage.getItem('navigoOrdnungData');
    if (saved) {
      try {
        appData = JSON.parse(saved);
        // Sicherstellen, dass alle erforderlichen Felder vorhanden sind
        if (!appData.apartmentLayout) appData.apartmentLayout = [];
        if (!appData.cellStates) appData.cellStates = [];
        if (!appData.rooms) appData.rooms = [];
        if (!appData.gridRows) appData.gridRows = 20;
        if (!appData.gridCols) appData.gridCols = 20;
        if (!appData.dailyResetHour) appData.dailyResetHour = 2;
      } catch (err) {
        console.warn('Fehler beim Laden aus localStorage, verwende Defaults:', err);
        // Defaults sind bereits gesetzt
      }
    }
  }

  function saveToLocalStorage() {
    localStorage.setItem('navigoOrdnungData', JSON.stringify(appData));
  }

});
