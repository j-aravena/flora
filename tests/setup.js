// IndexedDB simulado y JSZip global, igual que en el navegador (index.html carga jszip.min.js como script clásico).
import 'fake-indexeddb/auto';
import JSZip from 'jszip';

globalThis.JSZip = JSZip;
