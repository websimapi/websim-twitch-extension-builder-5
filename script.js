import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import { polyfill } from 'mobile-drag-drop';
import { setupExport } from './exportExtension.js';
import { setupServerDownload } from './serverDownload.js';
import { setupLiveSync } from './liveSync.js';

// Initialize drag and drop polyfill for mobile
polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
});

// State
let currentSelection = null;
let nextId = 1;

// View State Management
export const views = {
    panel: { id: 'panel', label: 'Panel', filename: 'panel.html', type: 'panel', elements: [] },
    mobile: { id: 'mobile', label: 'Mobile', filename: 'mobile.html', type: 'mobile', elements: [] },
    component: { id: 'component', label: 'Video Component', filename: 'video_component.html', type: 'component', elements: [] },
    overlay: { id: 'overlay', label: 'Video Overlay', filename: 'video_overlay.html', type: 'video_overlay', elements: [] },
    config: { id: 'config', label: 'Config', filename: 'config.html', type: 'config', elements: [] }
};
export let currentView = 'panel';

// DOM Elements
const canvas = document.getElementById('panel-canvas');
const modal = document.getElementById('property-modal');
const propertyForm = document.getElementById('property-form');
const btnCloseModal = document.getElementById('close-modal');
const btnSaveProps = document.getElementById('save-properties');
const btnDeleteElem = document.getElementById('delete-element');
const btnExport = document.getElementById('btn-export-extension');
const btnServer = document.getElementById('btn-download-server');
const emptyState = canvas.querySelector('.empty-state');
const canvasLabel = document.querySelector('.canvas-label');
const liveStatusEl = document.getElementById('live-status');

// --- Live status UI ---

function setLiveStatus(state) {
    if (!liveStatusEl) return;
    liveStatusEl.classList.remove('connecting', 'connected', 'disconnected');
    liveStatusEl.classList.add(state);

    const labelEl = liveStatusEl.querySelector('.label');
    if (!labelEl) return;

    if (state === 'connecting') {
        labelEl.textContent = 'Connecting…';
    } else if (state === 'connected') {
        labelEl.textContent = 'Live';
    } else {
        labelEl.textContent = 'Offline';
    }
}

// --- View Switching ---

document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const viewId = tab.dataset.view;
        switchView(viewId);
    });
});

function switchView(viewId) {
    if (currentView === viewId) return;

    // 1. Save current view state from DOM
    saveCurrentViewState();

    // 2. Clear Selection
    if (currentSelection) {
        currentSelection = null;
        closeModal();
    }

    // 3. Update Active View
    currentView = viewId;

    // 4. Update UI Tabs
    document.querySelectorAll('.view-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.view === viewId);
    });

    // 5. Update Canvas Mode & Label
    updateCanvasMode(viewId);

    // 6. Restore Elements to DOM
    renderCurrentView();
}

export function saveCurrentViewState() {
    const elements = [];
    const wrappers = canvas.querySelectorAll('.element-wrapper');
    wrappers.forEach(wrapper => {
        elements.push({
            type: wrapper.dataset.type,
            props: JSON.parse(wrapper.dataset.props)
        });
    });
    views[currentView].elements = elements;
}

function renderCurrentView() {
    // Clear Canvas
    canvas.innerHTML = '<div class="empty-state">Drag items here</div>';
    // Re-select empty state since we overwrote innerHTML
    const newEmptyState = canvas.querySelector('.empty-state');
    
    const elements = views[currentView].elements;

    if (elements && elements.length > 0) {
        newEmptyState.style.display = 'none';
        elements.forEach(el => {
            renderElementToCanvas(el.type, el.props);
        });
    } else {
        newEmptyState.style.display = 'block';
    }
}

function updateCanvasMode(viewId) {
    // Reset classes
    canvas.className = 'twitch-panel'; 
    
    switch(viewId) {
        case 'panel':
            canvasLabel.textContent = 'Twitch Panel Preview (320px width)';
            break;
        case 'mobile':
            canvasLabel.textContent = 'Mobile Preview (320px width)';
            break;
        case 'component':
            canvasLabel.textContent = 'Video Component (Resizable)';
            canvas.classList.add('component-mode');
            break;
        case 'overlay':
            canvasLabel.textContent = 'Video Overlay (16:9 Fullscreen)';
            canvas.classList.add('overlay-mode');
            break;
        case 'config':
            canvasLabel.textContent = 'Configuration Page (Full Width)';
            canvas.classList.add('config-mode');
            break;
    }
}

// --- Drag and Drop Logic ---

// Toolbox items
document.querySelectorAll('.tool-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    });
});

// Canvas Drop Zone
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('drag-over');
});

canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drag-over');
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    const type = e.dataTransfer.getData('type');
    if (type) {
        addElement(type);
    }
});

// --- Element Management ---

function addElement(type) {
    // Hide empty state if present
    const es = canvas.querySelector('.empty-state');
    if (es) es.style.display = 'none';

    // Get Defaults
    const data = getDefaultData(type);
    
    // Render
    renderElementToCanvas(type, data);
}

function renderElementToCanvas(type, props) {
    const id = `el-${nextId++}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'element-wrapper';
    wrapper.dataset.id = id;
    wrapper.dataset.type = type;
    wrapper.dataset.props = JSON.stringify(props);

    // Render Content
    renderElementContent(wrapper, type, props);

    // Click to edit
    wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        selectElement(wrapper);
    });

    canvas.appendChild(wrapper);
}

function getDefaultData(type) {
    switch(type) {
        case 'text': return { text: 'Hello Twitch!', color: '#efeff1', size: '16px', align: 'left' };
        case 'button': return { label: 'Click Me', bgColor: '#9146FF', color: '#ffffff' };
        case 'container': return { bgColor: '#26262c', padding: '10px', radius: '4px' };
        case 'image': return { src: 'https://placehold.co/300x150/9146FF/white?text=Image', alt: 'Placeholder' };
        case 'divider': return { color: '#3a3a3a', margin: '10px' };
        default: return {};
    }
}

export function renderElementContent(wrapper, type, data) {
    wrapper.innerHTML = ''; // Clear previous

    let content;
    switch(type) {
        case 'text':
            content = document.createElement('div');
            content.className = 'teb-text';
            content.textContent = data.text;
            content.style.color = data.color;
            content.style.fontSize = data.size;
            content.style.textAlign = data.align;
            break;
        case 'button':
            content = document.createElement('button');
            content.className = 'teb-btn';
            content.textContent = data.label;
            content.style.backgroundColor = data.bgColor;
            content.style.color = data.color;
            break;
        case 'container':
            content = document.createElement('div');
            content.className = 'teb-container';
            content.style.backgroundColor = data.bgColor;
            content.style.padding = data.padding;
            content.style.borderRadius = data.radius;
            content.textContent = 'Container Area';
            content.style.color = '#aaa';
            content.style.fontSize = '0.8rem';
            content.style.textAlign = 'center';
            content.style.border = '1px dashed #444';
            break;
        case 'image':
            content = document.createElement('img');
            content.className = 'teb-image';
            content.src = data.src;
            content.alt = data.alt;
            break;
        case 'divider':
            content = document.createElement('div');
            content.className = 'teb-divider';
            content.style.backgroundColor = data.color;
            content.style.marginTop = data.margin;
            content.style.marginBottom = data.margin;
            break;
    }

    if (content) wrapper.appendChild(content);
}

function selectElement(wrapper) {
    if (currentSelection) {
        currentSelection.classList.remove('selected');
    }
    currentSelection = wrapper;
    wrapper.classList.add('selected');
    openModal();
}

// --- Modal & Properties ---

function openModal() {
    if (!currentSelection) return;

    const type = currentSelection.dataset.type;
    const props = JSON.parse(currentSelection.dataset.props);

    propertyForm.innerHTML = ''; // Clear

    // Build Form based on type
    if (type === 'text') {
        addInput(propertyForm, 'Text', 'text', props.text);
        addInput(propertyForm, 'Color', 'color', props.color);
        addSelect(propertyForm, 'Size', 'size', props.size, ['12px', '14px', '16px', '20px', '24px']);
        addSelect(propertyForm, 'Align', 'align', props.align, ['left', 'center', 'right']);
    } else if (type === 'button') {
        addInput(propertyForm, 'Label', 'label', props.label);
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Text Color', 'color', props.color, 'color');
    } else if (type === 'container') {
        addInput(propertyForm, 'Background', 'bgColor', props.bgColor, 'color');
        addInput(propertyForm, 'Padding', 'padding', props.padding);
        addInput(propertyForm, 'Border Radius', 'radius', props.radius);
    } else if (type === 'image') {
        addInput(propertyForm, 'Image URL', 'src', props.src);
        addInput(propertyForm, 'Alt Text', 'alt', props.alt);
    } else if (type === 'divider') {
        addInput(propertyForm, 'Color', 'color', props.color, 'color');
        addInput(propertyForm, 'Margin', 'margin', props.margin);
    }

    modal.classList.remove('hidden');
}

function addInput(parent, label, key, value, type = 'text') {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.dataset.key = key;

    group.appendChild(input);
    parent.appendChild(group);
}

function addSelect(parent, label, key, value, options) {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `<label>${label}</label>`;

    const select = document.createElement('select');
    select.dataset.key = key;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });

    group.appendChild(select);
    parent.appendChild(group);
}

function closeModal() {
    modal.classList.add('hidden');
}

btnSaveProps.addEventListener('click', () => {
    if (!currentSelection) return;

    const inputs = propertyForm.querySelectorAll('input, select');
    const newProps = {};

    inputs.forEach(input => {
        newProps[input.dataset.key] = input.value;
    });

    currentSelection.dataset.props = JSON.stringify(newProps);
    renderElementContent(currentSelection, currentSelection.dataset.type, newProps);
    closeModal();
});

btnDeleteElem.addEventListener('click', () => {
    if (currentSelection) {
        currentSelection.remove();
        currentSelection = null;
        closeModal();
        
        // Check if empty
        if (canvas.querySelectorAll('.element-wrapper').length === 0) {
             const es = canvas.querySelector('.empty-state');
             if (es) es.style.display = 'block';
        }
    }
});

btnCloseModal.addEventListener('click', closeModal);

// --- Export Extension ---
// removed inline export extension logic (moved to exportExtension.js)

// --- Server Download ---
// removed inline server download and SSL generation logic (moved to serverDownload.js)

// Initialize modular features
setupExport({
    btnExport,
    views,
    saveCurrentViewState,
    renderElementContent
});

setupServerDownload({
    btnServer
});

// Live sync to local Node server (if running)
setupLiveSync({
    getViewsSnapshot: () => {
        // Always capture the latest DOM state before sending
        saveCurrentViewState();
        return views;
    },
    onStatusChange: (state) => {
        // state: 'connecting' | 'connected' | 'disconnected' | 'error'
        if (state === 'connecting') setLiveStatus('connecting');
        else if (state === 'connected') setLiveStatus('connected');
        else setLiveStatus('disconnected');
    }
});