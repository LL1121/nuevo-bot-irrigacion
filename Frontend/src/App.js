"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var emoji_picker_react_1 = require("emoji-picker-react");
function App() {
    var _this = this;
    var _a, _b, _c, _d;
    // Theme color mapping
    var themeColors = {
        emerald: { primary: 'emerald-600', gradient: 'from-emerald-500 to-teal-500', light: 'emerald-50', hex: '#10b981' },
        blue: { primary: 'blue-600', gradient: 'from-blue-500 to-cyan-500', light: 'blue-50', hex: '#3b82f6' },
        violet: { primary: 'violet-600', gradient: 'from-violet-500 to-purple-500', light: 'violet-50', hex: '#7c3aed' },
        amber: { primary: 'amber-600', gradient: 'from-amber-500 to-orange-500', light: 'amber-50', hex: '#d97706' }
    };
    var _e = (0, react_1.useState)(null), selectedChat = _e[0], setSelectedChat = _e[1];
    var _f = (0, react_1.useState)(''), message = _f[0], setMessage = _f[1];
    var _g = (0, react_1.useState)(''), searchQuery = _g[0], setSearchQuery = _g[1];
    var _h = (0, react_1.useState)(false), showInfo = _h[0], setShowInfo = _h[1];
    var _j = (0, react_1.useState)(false), showMenu = _j[0], setShowMenu = _j[1];
    var _k = (0, react_1.useState)(false), showEmojiPicker = _k[0], setShowEmojiPicker = _k[1];
    var _l = (0, react_1.useState)(false), showAttachMenu = _l[0], setShowAttachMenu = _l[1];
    var _m = (0, react_1.useState)(false), showSidebarMenu = _m[0], setShowSidebarMenu = _m[1];
    var _o = (0, react_1.useState)(false), darkMode = _o[0], setDarkMode = _o[1];
    var _p = (0, react_1.useState)('emerald'), theme = _p[0], setTheme = _p[1];
    var _q = (0, react_1.useState)(true), backgroundPattern = _q[0], setBackgroundPattern = _q[1];
    var _r = (0, react_1.useState)(false), soundEnabled = _r[0], setSoundEnabled = _r[1];
    var _s = (0, react_1.useState)(false), showPreferences = _s[0], setShowPreferences = _s[1];
    var _t = (0, react_1.useState)(false), showNewConversation = _t[0], setShowNewConversation = _t[1];
    var _u = (0, react_1.useState)(false), showArchived = _u[0], setShowArchived = _u[1];
    var _v = (0, react_1.useState)(''), newConvName = _v[0], setNewConvName = _v[1];
    var _w = (0, react_1.useState)(''), newConvPhone = _w[0], setNewConvPhone = _w[1];
    var _x = (0, react_1.useState)(''), newConvMessage = _x[0], setNewConvMessage = _x[1];
    var _y = (0, react_1.useState)(null), confirmDialog = _y[0], setConfirmDialog = _y[1];
    var _z = (0, react_1.useState)({ visible: false, x: 0, y: 0, type: null }), contextMenu = _z[0], setContextMenu = _z[1];
    var _0 = (0, react_1.useState)(false), selectionMode = _0[0], setSelectionMode = _0[1];
    var _1 = (0, react_1.useState)([]), selectedMessageIds = _1[0], setSelectedMessageIds = _1[1];
    var _2 = (0, react_1.useState)(false), chatClosed = _2[0], setChatClosed = _2[1];
    var _3 = (0, react_1.useState)(null), audioPlaying = _3[0], setAudioPlaying = _3[1];
    var _4 = (0, react_1.useState)({}), audioProgress = _4[0], setAudioProgress = _4[1];
    var _5 = (0, react_1.useState)(false), chatSearchMode = _5[0], setChatSearchMode = _5[1];
    var _6 = (0, react_1.useState)(''), chatSearchText = _6[0], setChatSearchText = _6[1];
    var _7 = (0, react_1.useState)(null), lightboxImage = _7[0], setLightboxImage = _7[1];
    var _8 = (0, react_1.useState)(null), lightboxVideo = _8[0], setLightboxVideo = _8[1];
    var _9 = (0, react_1.useState)(null), lightboxMessageId = _9[0], setLightboxMessageId = _9[1];
    var _10 = (0, react_1.useState)(null), highlightedMessage = _10[0], setHighlightedMessage = _10[1];
    var _11 = (0, react_1.useState)(1), imageZoom = _11[0], setImageZoom = _11[1];
    var _12 = (0, react_1.useState)(0), imageRotation = _12[0], setImageRotation = _12[1];
    var _13 = (0, react_1.useState)(false), dragOverChat = _13[0], setDragOverChat = _13[1];
    var _14 = (0, react_1.useState)(new Set()), expandedMessages = _14[0], setExpandedMessages = _14[1];
    var _15 = (0, react_1.useState)({}), noteDrafts = _15[0], setNoteDrafts = _15[1];
    var _16 = (0, react_1.useState)(null), copiedMessageId = _16[0], setCopiedMessageId = _16[1];
    var _17 = (0, react_1.useState)(false), showQuickMenu = _17[0], setShowQuickMenu = _17[1];
    var _18 = (0, react_1.useState)(false), infoPanelClosing = _18[0], setInfoPanelClosing = _18[1];
    var _19 = (0, react_1.useState)(null), replyingTo = _19[0], setReplyingTo = _19[1];
    var _20 = (0, react_1.useState)(null), editingMessage = _20[0], setEditingMessage = _20[1];
    var _21 = (0, react_1.useState)(false), showForwardMenu = _21[0], setShowForwardMenu = _21[1];
    var _22 = (0, react_1.useState)(null), forwardMessageId = _22[0], setForwardMessageId = _22[1];
    var _23 = (0, react_1.useState)(false), editingName = _23[0], setEditingName = _23[1];
    var _24 = (0, react_1.useState)(''), tempName = _24[0], setTempName = _24[1];
    var _25 = (0, react_1.useState)(false), showMediaMenu = _25[0], setShowMediaMenu = _25[1];
    var _26 = (0, react_1.useState)('all'), mediaFilter = _26[0], setMediaFilter = _26[1];
    var fileInputRef = (0, react_1.useRef)(null);
    var chatMenuRef = (0, react_1.useRef)(null);
    var emojiPickerRef = (0, react_1.useRef)(null);
    var attachMenuRef = (0, react_1.useRef)(null);
    var sidebarMenuRef = (0, react_1.useRef)(null);
    var contextMenuRef = (0, react_1.useRef)(null);
    var preferencesRef = (0, react_1.useRef)(null);
    var chatSearchRef = (0, react_1.useRef)(null);
    // Helpers para fechas de ejemplo
    var makeDate = function (hours, minutes, daysOffset) {
        if (daysOffset === void 0) { daysOffset = 0; }
        var d = new Date();
        d.setDate(d.getDate() + daysOffset);
        d.setHours(hours, minutes, 0, 0);
        return d.toISOString();
    };
    var conversations = [
        {
            id: 1,
            name: 'María González',
            lastMessage: 'Perfecto, gracias por la info!',
            time: '10:30',
            unread: 0,
            avatar: 'MG',
            status: 'online',
            operator: 'Juan P.',
            isTyping: false,
            conversationStatus: 'resolved',
            archived: false,
            padron: { number: '12345', location: 'Lote 12 - Zona Norte', debtStatus: 'Al Día' },
            notes: [
                { id: 1, text: 'Prefiere contacto por la mañana.' },
                { id: 2, text: 'Enviar recordatorio de mantenimiento semanal.' }
            ],
            messages: [
                { id: 1, text: 'Hola! Necesito info sobre el producto', time: '10:15', date: makeDate(10, 15, 0), sent: false, read: true },
                { id: 2, text: 'Claro! Te paso toda la información', time: '10:20', date: makeDate(10, 20, 0), sent: true, read: true },
                { id: 3, text: 'El precio es $5000 y viene con garantía', time: '10:21', date: makeDate(10, 21, 0), sent: true, read: true },
                { id: 4, text: 'foto_producto.jpg', time: '10:23', date: makeDate(10, 23, 0), sent: true, read: true, type: 'image', fileUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400' },
                { id: 5, text: 'video_demo.mp4', time: '10:24', date: makeDate(10, 24, 0), sent: true, read: true, type: 'video', fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
                { id: 6, text: 'propuesta.pdf', time: '10:25', date: makeDate(10, 25, 0), sent: true, read: true, type: 'file', filename: 'propuesta.pdf', size: '2.4 MB', fileUrl: '#' },
                { id: 7, text: 'Pueden ver más información en https://www.ejemplo.com/productos', time: '10:27', date: makeDate(10, 27, 0), sent: true, read: true },
                { id: 8, text: 'Perfecto, gracias por la info!', time: '10:30', date: makeDate(10, 30, 0), sent: false, read: true }
            ]
        },
        {
            id: 2,
            name: 'Carlos Rodríguez',
            lastMessage: 'Cuándo pueden entregar?',
            time: '09:45',
            unread: 3,
            avatar: 'CR',
            status: 'online',
            operator: null,
            isTyping: true,
            conversationStatus: 'attending',
            archived: false,
            padron: { number: '67890', location: 'Canal Principal - Sector B', debtStatus: 'Con Deuda' },
            notes: [
                { id: 3, text: 'Cliente solicita entrega urgente.' }
            ],
            messages: [
                { id: 1, text: 'Buenos días!', time: '09:40', date: makeDate(9, 40, 0), sent: false, read: false },
                { id: 2, text: 'Buen día Carlos! ¿En qué puedo ayudarte hoy?', time: '09:41', date: makeDate(9, 41, 0), sent: true, read: true },
                { id: 3, text: 'Quiero hacer un pedido', time: '09:42', date: makeDate(9, 42, 0), sent: false, read: false },
                { id: 4, text: 'foto_pedido.jpg', time: '09:43', date: makeDate(9, 43, 0), sent: false, read: false, type: 'image', fileUrl: 'https://images.unsplash.com/photo-1516796181074-bf453fbfa3e6?w=400' },
                { id: 5, text: 'nota_voz.mp3', time: '09:44', date: makeDate(9, 44, 0), sent: false, read: false, type: 'audio', duration: '0:32' },
                { id: 6, text: 'Perfecto! Revisando tu pedido ahora', time: '09:44', date: makeDate(9, 44, 0), sent: true, read: true },
                { id: 7, text: 'Cuándo pueden entregar?', time: '09:45', date: makeDate(9, 45, 0), sent: false, read: false }
            ]
        },
        {
            id: 3,
            name: 'Ana Martínez',
            lastMessage: 'Excelente servicio!',
            time: '08:20',
            unread: 0,
            avatar: 'AM',
            status: 'offline',
            operator: 'Laura S.',
            isTyping: false,
            conversationStatus: 'unattended',
            archived: false,
            padron: { number: '24680', location: 'Valle Sur - Tramo 3', debtStatus: 'Plan de Pago' },
            notes: [
                { id: 4, text: 'Cliente satisfecho, pidió encuesta.' }
            ],
            messages: [
                { id: 1, text: 'Hola, quería consultar sobre los planes de riego que ofrecen. Me interesa implementar un sistema moderno en mi campo de aproximadamente 50 hectáreas ubicado en la zona sur. He estado investigando y me gustaría saber qué opciones tienen disponibles, cuáles son los costos aproximados y si ofrecen algún tipo de financiamiento o plan de pagos. También me gustaría saber si hacen relevamiento del terreno previo y cuánto tiempo demora la instalación completa.', time: '08:10', date: makeDate(8, 10, -1), sent: false, read: true },
                { id: 2, text: 'Buenos días Ana! Claro, con gusto te ayudo. Te paso información completa sobre nuestros planes', time: '08:12', date: makeDate(8, 12, -1), sent: true, read: true },
                { id: 3, text: 'catalogo_riego.pdf', time: '08:13', date: makeDate(8, 13, -1), sent: true, read: true, type: 'file', filename: 'catalogo_riego.pdf', size: '3.8 MB', fileUrl: '#' },
                { id: 4, text: 'video_instalacion.mp4', time: '08:14', date: makeDate(8, 14, -1), sent: true, read: true, type: 'video', fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
                { id: 5, text: 'Ya recibí el pedido', time: '08:15', date: makeDate(8, 15, -1), sent: false, read: true },
                { id: 6, text: 'imagen_campo.jpg', time: '08:17', date: makeDate(8, 17, -1), sent: false, read: true, type: 'image', fileUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400' },
                { id: 7, text: 'Excelente servicio!', time: '08:20', date: makeDate(8, 20, -1), sent: false, read: true },
                { id: 8, text: 'Muchas gracias! Nos alegra que todo esté bien 😊', time: '08:25', date: makeDate(8, 25, -1), sent: true, read: true }
            ]
        },
        {
            id: 4,
            name: 'Pedro Sánchez',
            lastMessage: 'Ok, espero la factura',
            time: 'Ayer',
            unread: 0,
            avatar: 'PS',
            status: 'offline',
            operator: 'Juan P.',
            isTyping: false,
            conversationStatus: 'unattended',
            archived: false,
            padron: { number: '11223', location: 'Acequia Este - Km 5', debtStatus: 'Al Día' },
            notes: [
                { id: 5, text: 'Solicitó factura electrónica.' }
            ],
            messages: [
                { id: 1, text: 'Hola, buen día', time: 'Ayer', date: makeDate(14, 50, -1), sent: false, read: true },
                { id: 2, text: 'Necesito la factura del mes pasado', time: 'Ayer', date: makeDate(15, 0, -1), sent: false, read: true },
                { id: 3, text: 'audio_consulta.mp3', time: 'Ayer', date: makeDate(15, 5, -1), sent: false, read: true, type: 'audio', duration: '0:45' },
                { id: 4, text: 'Hola Pedro! Claro, te la envío en un momento', time: 'Ayer', date: makeDate(15, 10, -1), sent: true, read: true },
                { id: 5, text: 'factura_diciembre.pdf', time: 'Ayer', date: makeDate(15, 12, -1), sent: true, read: true, type: 'file', filename: 'factura_diciembre.pdf', size: '156 KB', fileUrl: '#' },
                { id: 6, text: 'También te dejo el link para ver el detalle online: https://facturacion.ejemplo.com/ver/123456', time: 'Ayer', date: makeDate(15, 13, -1), sent: true, read: true },
                { id: 7, text: 'comprobante_pago.jpg', time: 'Ayer', date: makeDate(15, 18, -1), sent: false, read: true, type: 'image', fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400' },
                { id: 8, text: 'Ok, espero la factura', time: 'Ayer', date: makeDate(15, 20, -1), sent: false, read: true }
            ]
        }
    ];
    var _27 = (0, react_1.useState)(conversations), conversationsState = _27[0], setConversationsState = _27[1];
    var currentChat = selectedChat !== null ? conversationsState[selectedChat] : null;
    var selectedId = selectedChat !== null ? (_a = conversationsState[selectedChat]) === null || _a === void 0 ? void 0 : _a.id : undefined;
    // Cerrar menús al hacer click fuera
    (0, react_1.useEffect)(function () {
        var handleClickOutside = function (event) {
            if (chatMenuRef.current && !chatMenuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
            if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
                setShowAttachMenu(false);
            }
            if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(event.target)) {
                setShowSidebarMenu(false);
            }
            if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
                setContextMenu({ visible: false, x: 0, y: 0, type: null });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return function () { return document.removeEventListener('mousedown', handleClickOutside); };
    }, []);
    // Dark mode: hydrate from storage and apply to html
    (0, react_1.useEffect)(function () {
        var stored = localStorage.getItem('darkMode');
        if (stored)
            setDarkMode(stored === 'true');
    }, []);
    // Load preferences from storage
    (0, react_1.useEffect)(function () {
        var storedTheme = localStorage.getItem('theme') || 'emerald';
        var storedBg = localStorage.getItem('backgroundPattern');
        var storedSound = localStorage.getItem('soundEnabled');
        setTheme(storedTheme);
        if (storedBg !== null)
            setBackgroundPattern(storedBg === 'true');
        if (storedSound !== null)
            setSoundEnabled(storedSound === 'true');
    }, []);
    // Persist preferences to storage
    (0, react_1.useEffect)(function () {
        localStorage.setItem('theme', theme);
        localStorage.setItem('backgroundPattern', String(backgroundPattern));
        localStorage.setItem('soundEnabled', String(soundEnabled));
    }, [theme, backgroundPattern, soundEnabled]);
    // Simulate audio playback progress based on real duration
    (0, react_1.useEffect)(function () {
        if (audioPlaying === null)
            return;
        // Find the audio message to get its duration
        var totalSeconds = 32; // default fallback
        for (var _i = 0, _a = conversations; _i < _a.length; _i++) {
            var conv = _a[_i];
            var msg = conv.messages.find(function (m) { return m.id === audioPlaying; });
            if (msg && msg.type === 'audio') {
                var duration = msg.duration || '0:32';
                var _b = duration.split(':').map(Number), mins = _b[0], secs = _b[1];
                totalSeconds = mins * 60 + secs;
                break;
            }
        }
        // Actualización suave cada 50ms para progreso continuo
        var interval = setInterval(function () {
            setAudioProgress(function (prev) {
                var _a;
                var incrementPerUpdate = (100 / totalSeconds) / 20; // 20 actualizaciones por segundo
                var newProgress = Math.min((prev[audioPlaying] || 0) + incrementPerUpdate, 100);
                if (newProgress >= 100) {
                    setAudioPlaying(null);
                }
                return __assign(__assign({}, prev), (_a = {}, _a[audioPlaying] = newProgress, _a));
            });
        }, 50);
        return function () { return clearInterval(interval); };
    }, [audioPlaying, conversations]);
    // En desktop, selecciona la primera conversación por defecto si no está cerrado
    (0, react_1.useEffect)(function () {
        if (!chatClosed && selectedChat === null && window.matchMedia('(min-width: 768px)').matches) {
            setSelectedChat(0);
        }
    }, [selectedChat, chatClosed]);
    // Close preferences on click outside
    (0, react_1.useEffect)(function () {
        var handleClickOutside = function (event) {
            if (preferencesRef.current && !preferencesRef.current.contains(event.target)) {
                setShowPreferences(false);
            }
        };
        if (showPreferences) {
            document.addEventListener('mousedown', handleClickOutside);
            return function () { return document.removeEventListener('mousedown', handleClickOutside); };
        }
    }, [showPreferences]);
    (0, react_1.useEffect)(function () {
        var root = document.documentElement;
        if (darkMode)
            root.classList.add('dark');
        else
            root.classList.remove('dark');
        localStorage.setItem('darkMode', String(darkMode));
    }, [darkMode]);
    // Función para cerrar el panel de información con animación
    var closeInfoPanel = function () {
        setInfoPanelClosing(true);
        setTimeout(function () {
            setShowInfo(false);
            setInfoPanelClosing(false);
        }, 300); // Duración de la animación slideOutRight
    };
    // Cierra la barra de búsqueda al hacer click fuera
    (0, react_1.useEffect)(function () {
        if (!chatSearchMode)
            return;
        var handler = function (e) {
            if (chatSearchRef.current && !chatSearchRef.current.contains(e.target)) {
                setChatSearchMode(false);
                setChatSearchText('');
            }
        };
        document.addEventListener('mousedown', handler);
        return function () { return document.removeEventListener('mousedown', handler); };
    }, [chatSearchMode]);
    var handleSendMessage = function () {
        if (message.trim()) {
            if (editingMessage) {
                saveEditMessage();
            }
            else {
                // Aquí iría la lógica de enviar mensaje
                // Por ahora solo limpiamos
                setMessage('');
                setReplyingTo(null);
            }
        }
    };
    var handleEmojiClick = function (emojiObject) {
        setMessage(function (prev) { return prev + emojiObject.emoji; });
        setShowEmojiPicker(false);
    };
    var handleFileSelect = function (e) {
        var _a;
        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            alert("Archivo seleccionado: ".concat(file.name));
        }
    };
    var handleAttachmentType = function (accept) {
        if (fileInputRef.current) {
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
        setShowAttachMenu(false);
    };
    // Context menu handlers
    var openContextMenu = function (e, type, targetId) {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: type, targetId: targetId });
    };
    var openBlankMenu = function (e) {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' });
    };
    var markChatReadById = function (id) {
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === id ? __assign(__assign({}, c), { unread: 0 }) : c; }); });
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var deleteConversationById = function (id) {
        setConversationsState(function (prev) { return prev.filter(function (c) { return c.id !== id; }); });
        if ((currentChat === null || currentChat === void 0 ? void 0 : currentChat.id) === id)
            setSelectedChat(0);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var createNewConversation = function () {
        if (!newConvName.trim() || !newConvPhone.trim())
            return;
        var newId = Math.max.apply(Math, __spreadArray(__spreadArray([], conversationsState.map(function (c) { return c.id; }), false), [0], false)) + 1;
        var newConv = {
            id: newId,
            name: newConvName.trim(),
            phone: newConvPhone.trim(),
            padron: Math.floor(Math.random() * 90000) + 10000,
            lastMessage: newConvMessage.trim() || 'Nueva conversación',
            time: 'Ahora',
            unread: 0,
            status: 'online',
            conversationStatus: 'unattended',
            archived: false,
            messages: newConvMessage.trim() ? [{
                    id: 1,
                    text: newConvMessage.trim(),
                    sent: false,
                    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                    read: false
                }] : [],
            isTyping: false
        };
        setConversationsState(function (prev) { return __spreadArray([newConv], prev, true); });
        setSelectedChat(0);
        setChatClosed(false);
        setShowNewConversation(false);
        setNewConvName('');
        setNewConvPhone('');
        setNewConvMessage('');
    };
    var archiveConversationById = function (id) {
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === id ? __assign(__assign({}, c), { archived: true }) : c; }); });
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var unarchiveConversationById = function (id) {
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === id ? __assign(__assign({}, c), { archived: false }) : c; }); });
    };
    var copyMessageById = function (id) {
        if (selectedChat === null)
            return;
        var msg = conversationsState[selectedChat].messages.find(function (m) { return m.id === id; });
        if (msg && navigator.clipboard)
            navigator.clipboard.writeText(msg.text);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var deleteMessageById = function (id) {
        if (selectedChat === null)
            return;
        var chatId = conversationsState[selectedChat].id;
        setConfirmDialog({
            visible: true,
            message: '¿Eliminar este mensaje?',
            onConfirm: function () {
                setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { messages: c.messages.filter(function (m) { return m.id !== id; }) }) : c; }); });
                setContextMenu({ visible: false, x: 0, y: 0, type: null });
                setConfirmDialog(null);
            }
        });
    };
    var replyToMessage = function (id) {
        if (selectedChat === null)
            return;
        var msg = conversationsState[selectedChat].messages.find(function (m) { return m.id === id; });
        if (msg) {
            var displayText = msg.text;
            if (msg.type === 'image')
                displayText = '📷 Imagen';
            else if (msg.type === 'video')
                displayText = '🎥 Video';
            else if (msg.type === 'audio')
                displayText = '🎤 Audio';
            else if (msg.type === 'file')
                displayText = "\uD83D\uDCC4 ".concat(msg.filename || 'Archivo');
            setReplyingTo({ id: msg.id, text: displayText });
        }
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var forwardMessage = function (id) {
        setForwardMessageId(id);
        setShowForwardMenu(true);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var confirmForward = function (targetChatId) {
        if (selectedChat === null || forwardMessageId === null)
            return;
        var msg = conversationsState[selectedChat].messages.find(function (m) { return m.id === forwardMessageId; });
        if (msg) {
            var targetChat = conversationsState.find(function (c) { return c.id === targetChatId; });
            if (targetChat) {
                var newMsgId_1 = Math.max.apply(Math, __spreadArray(__spreadArray([], targetChat.messages.map(function (m) { return m.id; }), false), [0], false)) + 1;
                setConversationsState(function (prev) { return prev.map(function (c) { return c.id === targetChatId ? __assign(__assign({}, c), { messages: __spreadArray(__spreadArray([], c.messages, true), [{
                            id: newMsgId_1,
                            text: msg.text,
                            sent: true,
                            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                            read: false,
                            type: msg.type,
                            fileUrl: msg.fileUrl,
                            filename: msg.filename,
                            size: msg.size,
                            duration: msg.duration
                        }], false) }) : c; }); });
            }
        }
        setShowForwardMenu(false);
        setForwardMessageId(null);
    };
    var startEditMessage = function (id) {
        if (selectedChat === null)
            return;
        var msg = conversationsState[selectedChat].messages.find(function (m) { return m.id === id; });
        if (msg && msg.sent) {
            setEditingMessage({ id: msg.id, text: msg.text });
            setMessage(msg.text);
        }
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var saveEditMessage = function () {
        if (selectedChat === null || editingMessage === null)
            return;
        var chatId = conversationsState[selectedChat].id;
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { messages: c.messages.map(function (m) { return m.id === editingMessage.id ? __assign(__assign({}, m), { text: message }) : m; }) }) : c; }); });
        setEditingMessage(null);
        setMessage('');
    };
    var cancelEdit = function () {
        setEditingMessage(null);
        setMessage('');
    };
    var startEditName = function () {
        if (selectedChat === null)
            return;
        setTempName(conversationsState[selectedChat].name);
        setEditingName(true);
    };
    var saveEditName = function () {
        if (selectedChat === null || !tempName.trim())
            return;
        var chatId = conversationsState[selectedChat].id;
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { name: tempName.trim() }) : c; }); });
        setEditingName(false);
        setTempName('');
    };
    var cancelEditName = function () {
        setEditingName(false);
        setTempName('');
    };
    var getMediaMessages = function () {
        if (selectedChat === null)
            return [];
        var messages = conversationsState[selectedChat].messages;
        switch (mediaFilter) {
            case 'images':
                return messages.filter(function (m) { return m.type === 'image'; });
            case 'videos':
                return messages.filter(function (m) { return m.type === 'video'; });
            case 'files':
                return messages.filter(function (m) { return m.type === 'file'; });
            case 'urls':
                return messages.filter(function (m) { return m.text && /https?:\/\/[^\s]+/.test(m.text); });
            default:
                return messages.filter(function (m) { return m.type === 'image' || m.type === 'video' || m.type === 'file' || (m.text && /https?:\/\/[^\s]+/.test(m.text)); });
        }
    };
    var goToMessage = function (messageId) {
        setLightboxImage(null);
        setLightboxVideo(null);
        setImageZoom(1);
        setImageRotation(0);
        // Scroll al mensaje
        setTimeout(function () {
            var messageElement = document.querySelector("[data-message-id=\"".concat(messageId, "\"]"));
            if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedMessage(messageId);
                setTimeout(function () { return setHighlightedMessage(null); }, 2000);
            }
        }, 100);
    };
    var replyFromLightbox = function (messageId) {
        if (selectedChat === null)
            return;
        var msg = conversationsState[selectedChat].messages.find(function (m) { return m.id === messageId; });
        if (msg) {
            var displayText = msg.text;
            if (msg.type === 'image')
                displayText = '📷 Imagen';
            else if (msg.type === 'video')
                displayText = '🎥 Video';
            else if (msg.type === 'audio')
                displayText = '🎤 Audio';
            else if (msg.type === 'file')
                displayText = "\uD83D\uDCC4 ".concat(msg.filename || 'Archivo');
            setReplyingTo({ id: msg.id, text: displayText });
            setLightboxImage(null);
            setLightboxVideo(null);
            setLightboxMessageId(null);
            setImageZoom(1);
            setImageRotation(0);
        }
    };
    var forwardFromLightbox = function (messageId) {
        setForwardMessageId(messageId);
        setShowForwardMenu(true);
        setLightboxImage(null);
        setLightboxVideo(null);
        setLightboxMessageId(null);
        setImageZoom(1);
        setImageRotation(0);
    };
    var startSelection = function () {
        setSelectionMode(true);
        setSelectedMessageIds([]);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var toggleMessageSelection = function (id) {
        setSelectedMessageIds(function (prev) { return prev.includes(id) ? prev.filter(function (x) { return x !== id; }) : __spreadArray(__spreadArray([], prev, true), [id], false); });
    };
    var deleteSelectedMessages = function () {
        if (selectedChat === null)
            return;
        if (selectedMessageIds.length === 0) {
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
            return;
        }
        var chat = conversationsState[selectedChat];
        var ownSelectedIds = selectedMessageIds.filter(function (id) {
            var m = chat.messages.find(function (mm) { return mm.id === id; });
            return (m === null || m === void 0 ? void 0 : m.sent) === true;
        });
        if (ownSelectedIds.length === 0) {
            // Nada propio para borrar
            setContextMenu({ visible: false, x: 0, y: 0, type: null });
            return;
        }
        var chatId = chat.id;
        setConfirmDialog({
            visible: true,
            message: "\u00BFEliminar ".concat(ownSelectedIds.length, " mensaje(s) propios?"),
            onConfirm: function () {
                setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { messages: c.messages.filter(function (m) { return !ownSelectedIds.includes(m.id); }) }) : c; }); });
                setSelectedMessageIds([]);
                setSelectionMode(false);
                setContextMenu({ visible: false, x: 0, y: 0, type: null });
                setConfirmDialog(null);
            }
        });
    };
    var exitSelection = function () {
        setSelectedMessageIds([]);
        setSelectionMode(false);
        setContextMenu({ visible: false, x: 0, y: 0, type: null });
    };
    var toggleExpandMessage = function (id) {
        setExpandedMessages(function (prev) {
            var newSet = new Set(prev);
            if (newSet.has(id))
                newSet.delete(id);
            else
                newSet.add(id);
            return newSet;
        });
    };
    var getFilteredMessages = function () {
        if (selectedChat === null)
            return [];
        var chat = conversationsState[selectedChat];
        if (!chatSearchText.trim())
            return chat.messages;
        return chat.messages.filter(function (msg) {
            return msg.text.toLowerCase().includes(chatSearchText.toLowerCase());
        });
    };
    var updatePadronField = function (field, value) {
        if (selectedChat === null)
            return;
        var chatId = conversationsState[selectedChat].id;
        setConversationsState(function (prev) { return prev.map(function (c) {
            var _a;
            return c.id === chatId ? __assign(__assign({}, c), { padron: __assign(__assign({}, (c.padron || {})), (_a = {}, _a[field] = value, _a)) }) : c;
        }); });
    };
    var addNote = function () {
        if (selectedChat === null)
            return;
        var chatId = conversationsState[selectedChat].id;
        var draft = noteDrafts[chatId] || '';
        if (!draft.trim())
            return;
        var newNote = { id: Date.now(), text: draft.trim() };
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { notes: __spreadArray(__spreadArray([], (c.notes || []), true), [newNote], false) }) : c; }); });
        setNoteDrafts(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[chatId] = '', _a)));
        });
    };
    var deleteNote = function (noteId) {
        if (selectedChat === null)
            return;
        var chatId = conversationsState[selectedChat].id;
        setConversationsState(function (prev) { return prev.map(function (c) { return c.id === chatId ? __assign(__assign({}, c), { notes: (c.notes || []).filter(function (n) { return n.id !== noteId; }) }) : c; }); });
    };
    var insertQuickText = function (text) {
        setMessage(function (prev) { return (prev ? "".concat(prev, " ").concat(text) : text); });
    };
    var handleCopyMessage = function (msg) { return __awaiter(_this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!navigator.clipboard || !(msg === null || msg === void 0 ? void 0 : msg.text))
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, navigator.clipboard.writeText(msg.text)];
                case 2:
                    _a.sent();
                    setCopiedMessageId(msg.id);
                    setTimeout(function () { return setCopiedMessageId(null); }, 1200);
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('No se pudo copiar', e_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    // Mock isOnline state for connection bar
    var isOnline = true;
    var filteredConversations = conversationsState.filter(function (conv) {
        // Filtrar archivadas
        if (conv.archived)
            return false;
        var query = searchQuery.toLowerCase().trim();
        if (!query)
            return true;
        return (conv.name.toLowerCase().includes(query) ||
            conv.lastMessage.toLowerCase().includes(query) ||
            conv.messages.some(function (msg) { return msg.text.toLowerCase().includes(query); }));
    });
    var archivedConversations = conversationsState.filter(function (conv) { return conv.archived; });
    var markResolved = function () {
        if (selectedChat === null)
            return;
        setConversationsState(function (prev) {
            var next = __spreadArray([], prev, true);
            next[selectedChat] = __assign(__assign({}, next[selectedChat]), { conversationStatus: 'resolved', unread: 0 });
            return next;
        });
        setShowMenu(false);
    };
    var deleteConversation = function () {
        if (selectedChat === null)
            return;
        setConversationsState(function (prev) {
            var next = prev.filter(function (_, idx) { return idx !== selectedChat; });
            return next.length ? next : prev; // avoid empty for demo
        });
        setSelectedChat(function (idx) {
            if (idx === null)
                return null;
            return Math.max(0, idx - 1);
        });
        setShowMenu(false);
        setShowInfo(false);
    };
    return (<div className="flex h-screen bg-gray-100 dark:bg-gray-900 dark:text-gray-100 flex-col">
      {!isOnline && (<div className="bg-orange-500 text-white px-4 py-2 text-center text-sm font-medium animate-pulse">
          Sin conexión - Intentando reconectar...
        </div>)}
      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar - Lista de conversaciones */}
      <div className={"".concat(selectedChat === null ? 'block' : 'hidden', " md:flex w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col")}>
        {/* Header */}
        <div className="p-4 text-white" style={{ background: "linear-gradient(to right, ".concat(themeColors[theme].hex, ", #14b8a6)") }}>
          <div className="flex items-center justify-between mb-4">
            <img src="/Marca-IRRIGACIÓN-blanco.png" alt="Irrigación" className="h-20 -ml-2"/>
            <div className="flex items-center gap-2 relative" ref={sidebarMenuRef}>
              <button className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors" onClick={function () { return setShowSidebarMenu(function (v) { return !v; }); }}>
                <lucide_react_1.MoreVertical size={20}/>
              </button>
              {showSidebarMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 animate-slideInDown">
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100" onClick={function () { setShowNewConversation(true); setShowSidebarMenu(false); }}>
                    Nueva conversación
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100" onClick={function () { return setConversationsState(function (prev) { return prev.map(function (c) { return (__assign(__assign({}, c), { unread: 0 })); }); }); }}>
                    Marcar todas como leídas
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100" onClick={function () { setShowArchived(true); setShowSidebarMenu(false); }}>
                    Archivar conversaciones
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100" onClick={function () { setShowPreferences(true); setShowSidebarMenu(false); }}>
                    Configuración
                  </button>
                </div>)}
            </div>
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <lucide_react_1.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-700 dark:text-gray-200" size={18}/>
            <input type="text" placeholder="Buscar conversación..." value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }} className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all text-gray-900 placeholder-gray-500 dark:bg-white/10 dark:text-white dark:placeholder-white dark:focus:bg-white/10"/>
          </div>
        </div>

        {/* Conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(function (conv, idx) { return (<div key={conv.id} onContextMenu={function (e) { return openContextMenu(e, 'chat', conv.id); }} onClick={function () {
                var originalIndex = conversationsState.findIndex(function (c) { return c.id === conv.id; });
                setSelectedChat(originalIndex === -1 ? idx : originalIndex);
                setChatClosed(false);
            }} className={"p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700"} style={selectedId === conv.id ? {
                backgroundColor: darkMode ? "".concat(themeColors[theme].hex, "20") : "".concat(themeColors[theme].hex, "10"),
                borderLeft: "4px solid ".concat(themeColors[theme].hex)
            } : {}}>
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold transition-colors" style={{
                backgroundColor: selectedId === conv.id ? themeColors[theme].hex : undefined,
                backgroundImage: selectedId !== conv.id ? "linear-gradient(135deg, ".concat(themeColors[theme].hex, ", #14b8a6)") : undefined
            }}>
                    {conv.avatar}
                  </div>
                  {conv.status === 'online' && (<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.name}</h3>
                    {conv.unread > 0 ? (<span className="text-white text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: themeColors[theme].hex }}>
                        {conv.unread}
                      </span>) : (!conv.isTyping && <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{conv.time}</span>)}
                  </div>
                  {conv.isTyping ? (<p className="text-sm animate-pulse" style={{ color: themeColors[theme].hex }}>Escribiendo...</p>) : (<p className="text-sm text-gray-600 dark:text-gray-300 truncate mb-1">{conv.lastMessage}</p>)}
                  <div className="flex items-center justify-end">
                  </div>
                </div>
              </div>
            </div>); })}
        </div>
      </div>

      {/* Chat Principal */}
      <div className={"".concat(selectedChat === null ? 'hidden md:hidden' : 'flex md:flex', " flex-1 flex-col bg-gray-50 dark:bg-gray-900 transition-opacity duration-200")}>
        {/* Chat Header */}
        {currentChat && (<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button only on mobile */}
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" onClick={function () { return setSelectedChat(null); }} aria-label="Volver">
              <lucide_react_1.ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200"/>
            </button>
            <button onClick={function () { return setShowInfo(function (v) { return !v; }); }} className="flex items-center gap-3 text-left focus:outline-none">
              <div className="relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{
                backgroundImage: "linear-gradient(135deg, ".concat(themeColors[theme].hex, ", #14b8a6)")
            }}>
                  {currentChat.avatar}
                </div>
                {currentChat.status === 'online' && (<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>)}
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition" onContextMenu={function (e) { e.preventDefault(); startEditName(); }}>
                  {currentChat.name}
                </div>
                <p className="text-xs text-gray-500">
                  {currentChat.status === 'online' ? 'En línea' : 'Desconectado'}
                </p>
              </div>
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex items-center" ref={chatSearchRef}>
              <div className={"flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden transition-all duration-200 ease-out ".concat(chatSearchMode ? 'w-48 px-3 py-2 opacity-100' : 'w-0 px-0 py-0 opacity-0 pointer-events-none')} style={{ boxShadow: chatSearchMode ? '0 4px 12px rgba(0,0,0,0.08)' : undefined }}>
                <lucide_react_1.Search size={16} className="text-gray-500 mr-2 flex-shrink-0"/>
                <input type="text" placeholder="Buscar..." value={chatSearchText} onChange={function (e) { return setChatSearchText(e.target.value); }} className="bg-transparent text-sm flex-1 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400" autoFocus={chatSearchMode}/>
                <button className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500" onClick={function () {
                setChatSearchText('');
                setChatSearchMode(false);
            }}>
                  <lucide_react_1.X size={14}/>
                </button>
              </div>
              <button className={"p-2 rounded-lg transition-all duration-200 ease-out ".concat(chatSearchMode
                ? 'opacity-0 scale-90 pointer-events-none'
                : 'opacity-100 scale-100 pointer-events-auto', " hover:bg-gray-100 dark:hover:bg-gray-700")} style={{ transitionDelay: chatSearchMode ? '0ms' : '160ms' }} onClick={function () { return setChatSearchMode(true); }}>
                <lucide_react_1.Search size={20} className="text-gray-600 dark:text-gray-300"/>
              </button>
            </div>
            <div className="relative" ref={chatMenuRef}>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={function () { return setShowMenu(function (v) { return !v; }); }}>
              <lucide_react_1.MoreVertical size={20} className="text-gray-600 dark:text-gray-300"/>
            </button>
            {showMenu && (<div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 animate-slideInDown">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={markResolved}>
                  Marcar como atendida
                </button>
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={deleteConversation}>
                  Eliminar conversación
                </button>
              </div>)}
            </div>
          </div>
        </div>)}

        {/* Mensajes */}
        {currentChat && (<div key={selectedChat} className="flex-1 overflow-y-auto p-6 space-y-4 relative pb-6 animate-fadeIn" onContextMenu={openBlankMenu} onDragOver={function (e) {
                e.preventDefault();
                setDragOverChat(true);
            }} onDragLeave={function () { return setDragOverChat(false); }} onDrop={function (e) {
                e.preventDefault();
                setDragOverChat(false);
                var files = e.dataTransfer.files;
                if (files.length > 0) {
                    console.log('Archivos soltados:', Array.from(files).map(function (f) { return f.name; }));
                }
            }} style={{
                backgroundImage: backgroundPattern ? "\n              url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png),\n              repeating-linear-gradient(\n                45deg,\n                transparent,\n                transparent 10px,\n                rgba(255, 255, 255, 0.03) 10px,\n                rgba(255, 255, 255, 0.03) 20px\n              )\n            " : undefined,
                backgroundColor: darkMode ? '#0b141a' : '#efeae2',
                backgroundBlendMode: 'overlay',
                opacity: darkMode ? 1 : 0.98
            }}>
          {dragOverChat && (<div className="absolute inset-0 bg-black/30 rounded-lg border-2 border-dashed border-white flex items-center justify-center z-40">
              <div className="text-white text-center">
                <p className="text-lg font-semibold">Soltá el archivo aquí</p>
              </div>
            </div>)}
          {selectionMode && (<div className="absolute top-4 right-4 flex items-center gap-2">
              <button className="p-2 rounded-full shadow-lg bg-gray-600 text-white hover:bg-gray-700 transition" title="Cancelar selección" onClick={function () { return exitSelection(); }}>
                <lucide_react_1.X className="w-5 h-5"/>
              </button>
              <button className={"p-2 rounded-full shadow-lg bg-red-600 text-white hover:bg-red-700 transition ".concat((function () {
                    if (selectedChat === null)
                        return 'opacity-50 cursor-not-allowed';
                    var ownIds = selectedMessageIds.filter(function (id) {
                        var m = conversationsState[selectedChat].messages.find(function (mm) { return mm.id === id; });
                        return (m === null || m === void 0 ? void 0 : m.sent) === true;
                    });
                    return ownIds.length === 0 ? 'opacity-50 cursor-not-allowed' : '';
                })())} title="Eliminar seleccionados" onClick={function () { return deleteSelectedMessages(); }}>
                <div className="flex items-center gap-2">
                  <lucide_react_1.Trash className="w-5 h-5"/>
                  <span className="text-sm font-semibold">
                    {(function () {
                    if (selectedChat === null)
                        return '(0)';
                    var ownIds = selectedMessageIds.filter(function (id) {
                        var m = conversationsState[selectedChat].messages.find(function (mm) { return mm.id === id; });
                        return (m === null || m === void 0 ? void 0 : m.sent) === true;
                    });
                    return "(".concat(ownIds.length, ")");
                })()}
                  </span>
                </div>
              </button>
            </div>)}
          {getFilteredMessages().map(function (msg, idx) {
                var _a, _b, _c;
                var filteredMessages = getFilteredMessages();
                var prev = idx > 0 ? filteredMessages[idx - 1] : null;
                var labelFor = function (m) {
                    if (!(m === null || m === void 0 ? void 0 : m.date))
                        return '';
                    var d = new Date(m.date);
                    var today = new Date();
                    var yday = new Date();
                    yday.setDate(today.getDate() - 1);
                    var sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
                    if (sameDay(d, today))
                        return 'Hoy';
                    if (sameDay(d, yday))
                        return 'Ayer';
                    return d.toLocaleDateString();
                };
                var currLabel = labelFor(msg);
                var prevLabel = labelFor(prev);
                var isImage = msg.type === 'image' || (typeof msg.text === 'string' && (msg.text.startsWith('http') || msg.text.startsWith('data:image')));
                return (<div key={msg.id} className="space-y-2">
                {currLabel && currLabel !== prevLabel && (<div className="flex justify-center my-2 animate-fadeIn">
                    <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-xs">
                      {currLabel}
                    </span>
                  </div>)}
                <div className={"flex ".concat(msg.sent ? 'justify-end' : 'justify-start', " animate-in fade-in slide-in-from-bottom-2 duration-300")}>
                  <div className="relative" onClick={function () { return selectionMode && toggleMessageSelection(msg.id); }} data-message-id={msg.id}>
                    <div className={"absolute inset-0 rounded-2xl transition-all duration-500 pointer-events-none ".concat(highlightedMessage === msg.id ? 'ring-4 ring-yellow-400 dark:ring-yellow-500 animate-pulse' : '')}/>
                    {selectionMode && (<button className="absolute -left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md border shadow" style={{
                            backgroundColor: selectedMessageIds.includes(msg.id) ? themeColors[theme].hex : 'white',
                            borderColor: selectedMessageIds.includes(msg.id) ? themeColors[theme].hex : '#d1d5db'
                        }} onClick={function (e) { e.stopPropagation(); toggleMessageSelection(msg.id); }} aria-label={selectedMessageIds.includes(msg.id) ? 'Deseleccionar' : 'Seleccionar'}>
                        {selectedMessageIds.includes(msg.id) && (<lucide_react_1.Check className="w-4 h-4 text-white"/>)}
                      </button>)}
                  {isImage ? (<div className="relative max-w-[280px] sm:max-w-xs rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity group" style={selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {}} onContextMenu={function (e) { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }} onClick={function () {
                            setLightboxImage(msg.fileUrl || msg.text);
                            setLightboxMessageId(msg.id);
                        }}>
                      <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/40 text-white p-1 rounded-full" onClick={function (e) { e.stopPropagation(); handleCopyMessage(msg); }} title="Copiar">
                        {copiedMessageId === msg.id ? <lucide_react_1.Check size={14}/> : <lucide_react_1.Copy size={14}/>}
                      </button>
                      <img src={msg.fileUrl || msg.text} alt="imagen" className="w-full h-auto object-cover"/>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 flex items-center justify-end gap-1 text-white/90">
                        <span className="text-[10px] leading-none">{msg.time}</span>
                        {msg.sent && (msg.read ? <lucide_react_1.CheckCheck size={12}/> : <lucide_react_1.Check size={12}/>)}
                      </div>
                    </div>) : msg.type === 'video' ? (<div className="relative max-w-[280px] sm:max-w-xs rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:opacity-90 transition-opacity group" style={selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {}} onContextMenu={function (e) { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }} onClick={function () { setLightboxVideo(msg.fileUrl); setLightboxMessageId(msg.id); }}>
                      <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/40 text-white p-1 rounded-full z-10" onClick={function (e) { e.stopPropagation(); handleCopyMessage(msg); }} title="Copiar">
                        {copiedMessageId === msg.id ? <lucide_react_1.Check size={14}/> : <lucide_react_1.Copy size={14}/>}
                      </button>
                      <video src={msg.fileUrl} className="w-full h-auto object-cover" controls preload="metadata"/>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 flex items-center justify-end gap-1 text-white/90">
                        <span className="text-[10px] leading-none">{msg.time}</span>
                        {msg.sent && (msg.read ? <lucide_react_1.CheckCheck size={12}/> : <lucide_react_1.Check size={12}/>)}
                      </div>
                    </div>) : msg.type === 'audio' ? (<div className={"relative group max-w-[260px] sm:max-w-sm px-4 py-3 rounded-2xl shadow-sm ".concat(msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm')} style={msg.sent ? __assign({ backgroundImage: "linear-gradient(to right, ".concat(themeColors[theme].hex, ", #14b8a6)") }, (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})) : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})} onContextMenu={function (e) { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}>
                      <button className={"absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ".concat(msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')} onClick={function (e) { e.stopPropagation(); handleCopyMessage(msg); }} title="Copiar">
                        {copiedMessageId === msg.id ? <lucide_react_1.Check size={14}/> : <lucide_react_1.Copy size={14}/>}
                      </button>
                      <div className="flex items-center gap-3">
                        <button onClick={function () { return setAudioPlaying(audioPlaying === msg.id ? null : msg.id); }} className={"p-2 rounded-full flex-shrink-0 transition-all ".concat(msg.sent
                            ? 'bg-white/20 hover:bg-white/30 text-white'
                            : "hover:bg-gray-100 dark:hover:bg-gray-700")} style={!msg.sent ? { color: themeColors[theme].hex } : undefined}>
                          {audioPlaying === msg.id ? (<lucide_react_1.Pause size={20}/>) : (<lucide_react_1.Play size={20}/>)}
                        </button>
                        <div className="flex-1">
                          {(function () {
                            var duration = msg.duration || '0:32';
                            var _a = duration.split(':').map(Number), mins = _a[0], secs = _a[1];
                            var totalSeconds = mins * 60 + secs;
                            var currentSeconds = Math.floor((audioProgress[msg.id] || 0) / 100 * totalSeconds);
                            var currentMins = Math.floor(currentSeconds / 60);
                            var currentSecs = currentSeconds % 60;
                            var isPlaying = audioPlaying === msg.id;
                            return (<>
                                <div className="w-full bg-white/30 rounded-full h-1 mb-1" style={{ width: "".concat(Math.max(60, totalSeconds * 4), "px") }}>
                                  <div className="h-full rounded-full transition-all" style={{
                                    width: "".concat(audioProgress[msg.id] || 0, "%"),
                                    backgroundColor: msg.sent ? 'white' : themeColors[theme].hex
                                }}/>
                                </div>
                                <div className={"text-xs ".concat(msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
                                  {isPlaying ? (<span>{String(currentMins).padStart(2, '0')}:{String(currentSecs).padStart(2, '0')} / {duration}</span>) : (<span>{duration}</span>)}
                                </div>
                              </>);
                        })()}
                        </div>
                      </div>
                      <div className={"flex items-center gap-1 justify-end mt-2 ".concat(msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (msg.read ? <lucide_react_1.CheckCheck size={12}/> : <lucide_react_1.Check size={12}/>)}
                      </div>
                    </div>) : msg.type === 'file' ? (<a href={msg.fileUrl || '#'} target="_blank" rel="noopener noreferrer" className={"relative group max-w-[260px] sm:max-w-sm px-4 py-3 rounded-2xl shadow-sm block hover:opacity-90 transition-opacity ".concat(msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm')} style={msg.sent ? __assign({ backgroundImage: "linear-gradient(to right, ".concat(themeColors[theme].hex, ", #14b8a6)") }, (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})) : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})} onClick={function (e) { return e.stopPropagation(); }} onContextMenu={function (e) { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}>
                      <button className={"absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ".concat(msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')} onClick={function (e) { e.stopPropagation(); handleCopyMessage(msg); }} title="Copiar">
                        {copiedMessageId === msg.id ? <lucide_react_1.Check size={14}/> : <lucide_react_1.Copy size={14}/>}
                      </button>
                      <div className="flex items-start gap-3">
                        {(function () {
                            var _a;
                            var isPdf = (_a = msg.filename) === null || _a === void 0 ? void 0 : _a.toLowerCase().endsWith('.pdf');
                            var isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.filename || '');
                            if (isPdf && msg.fileUrl) {
                                return (<div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-white/20">
                                <iframe src={"".concat(msg.fileUrl, "#page=1&toolbar=0&navpanes=0&scrollbar=0")} className="w-full h-full pointer-events-none scale-150 origin-top-left"/>
                              </div>);
                            }
                            else if (isImage && msg.fileUrl) {
                                return (<img src={msg.fileUrl} alt={msg.filename} className="flex-shrink-0 w-16 h-16 rounded object-cover"/>);
                            }
                            else {
                                return <lucide_react_1.FileText size={32} className={msg.sent ? 'text-white/80 flex-shrink-0' : "flex-shrink-0"} style={!msg.sent ? { color: themeColors[theme].hex } : undefined}/>;
                            }
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{msg.filename || msg.text}</p>
                          <p className={"text-xs ".concat(msg.sent ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>
                            {((_c = (_b = (_a = msg.filename) === null || _a === void 0 ? void 0 : _a.split('.')) === null || _b === void 0 ? void 0 : _b.pop()) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || 'FILE'} • {msg.size || '0 MB'}
                          </p>
                        </div>
                      </div>
                      <div className={"flex items-center gap-1 justify-end mt-2 ".concat(msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (msg.read ? <lucide_react_1.CheckCheck size={12}/> : <lucide_react_1.Check size={12}/>)}
                      </div>
                    </a>) : (<div className={"relative group max-w-[280px] sm:max-w-md px-4 py-2 rounded-2xl shadow-sm ".concat(msg.sent ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm')} style={msg.sent ? __assign({ backgroundImage: "linear-gradient(to right, ".concat(themeColors[theme].hex, ", #14b8a6)") }, (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})) : (selectionMode && selectedMessageIds.includes(msg.id) ? { boxShadow: "0 0 0 2px ".concat(themeColors[theme].hex) } : {})} onContextMenu={function (e) { openContextMenu(e, 'message', msg.id); e.stopPropagation(); }}>
                      <button className={"absolute top-2 right-2 p-1 rounded-full transition opacity-0 group-hover:opacity-100 ".concat(msg.sent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700')} onClick={function (e) { e.stopPropagation(); handleCopyMessage(msg); }} title="Copiar">
                        {copiedMessageId === msg.id ? <lucide_react_1.Check size={14}/> : <lucide_react_1.Copy size={14}/>}
                      </button>
                      {(function () {
                            var fullText = msg.text;
                            var isExpanded = expandedMessages.has(msg.id);
                            var isTruncated = fullText.length > 300;
                            var displayText = isTruncated && !isExpanded ? fullText.substring(0, 300) + '...' : fullText;
                            return (<>
                            <p className="text-sm">{displayText}</p>
                            {isTruncated && (<button onClick={function (e) {
                                        e.stopPropagation();
                                        toggleExpandMessage(msg.id);
                                    }} className={"text-xs mt-1 font-medium ".concat(msg.sent
                                        ? 'text-white/80 hover:text-white'
                                        : "hover:opacity-80")} style={!msg.sent ? { color: themeColors[theme].hex } : undefined}>
                                {isExpanded ? 'Leer menos' : 'Leer más'}
                              </button>)}
                          </>);
                        })()}
                      <div className={"flex items-center gap-1 justify-end mt-1 ".concat(msg.sent ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
                        <span className="text-xs">{msg.time}</span>
                        {msg.sent && (msg.read ? <lucide_react_1.CheckCheck size={14}/> : <lucide_react_1.Check size={14}/>)}
                      </div>
                    </div>)}
                  </div>
                </div>
              </div>);
            })}
        </div>)}

        {/* Input de mensaje */}
        {currentChat && (<>
          <div className="relative">
            <div className="absolute left-0 right-0 bottom-full pb-2 px-4 pointer-events-none">
              <div className="flex items-center justify-center pointer-events-auto">
                <button className="p-2 transition flex items-center justify-center hover:opacity-80" onClick={function () { return setShowQuickMenu(function (v) { return !v; }); }} aria-label="Mostrar acciones rápidas" style={{ color: themeColors[theme].hex }}>
                  <lucide_react_1.ChevronUp size={18} className={"transition-transform ".concat(showQuickMenu ? 'rotate-180' : '')}/>
                </button>
              </div>
              <div className={"overflow-hidden transition-all duration-300 ease-out ".concat(showQuickMenu ? 'max-h-28 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2')}>
                <div className="flex overflow-x-auto gap-2 pb-3 -mx-1 px-1 text-sm justify-center pointer-events-auto">
                  {[
                { label: 'Pedir DNI', text: 'Por favor, podrías enviarme tu DNI para avanzar?' },
                { label: 'Pedir Boleta', text: '¿Podrías mandarme la boleta o comprobante de pago?' },
                { label: 'Enviar Ubicación', text: 'Te comparto mi ubicación para coordinar: ' },
                { label: 'Enviar CBU', text: 'Te paso el CBU para la transferencia: ' }
            ].map(function (chip) { return (<button key={chip.label} className="whitespace-nowrap px-3 py-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-600 transition shadow-sm" onClick={function () { return insertQuickText(chip.text); }}>
                      {chip.label}
                    </button>); })}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          {(replyingTo || editingMessage) && (<div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {editingMessage ? 'Editando mensaje' : 'Respondiendo a'}
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                  {editingMessage ? editingMessage.text : replyingTo === null || replyingTo === void 0 ? void 0 : replyingTo.text}
                </p>
              </div>
              <button onClick={function () {
                    if (editingMessage)
                        cancelEdit();
                    else
                        setReplyingTo(null);
                }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                <lucide_react_1.X size={16} className="text-gray-600 dark:text-gray-300"/>
              </button>
            </div>)}
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"/>
          <div className="flex items-center gap-3">
            <div className="relative" ref={attachMenuRef}>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={function () { return setShowAttachMenu(function (v) { return !v; }); }}>
                <lucide_react_1.Paperclip size={22} className="text-gray-600 dark:text-gray-300"/>
              </button>
              {showAttachMenu && (<div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-slideInUp">
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3" onClick={function () { return handleAttachmentType('image/*'); }}>
                    <lucide_react_1.Image size={18} className="text-blue-600"/>
                    <span className="text-gray-700">Imagen</span>
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3" onClick={function () { return handleAttachmentType('.pdf,.doc,.docx,.txt'); }}>
                    <lucide_react_1.FileText size={18} className="text-emerald-600"/>
                    <span className="text-gray-700">Documento</span>
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3" onClick={function () { return handleAttachmentType('video/*'); }}>
                    <lucide_react_1.Video size={18} className="text-purple-600"/>
                    <span className="text-gray-700">Video</span>
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3" onClick={function () { return handleAttachmentType('audio/*'); }}>
                    <lucide_react_1.Music size={18} className="text-orange-600"/>
                    <span className="text-gray-700">Audio</span>
                  </button>
                </div>)}
            </div>
            
            <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2 relative">
              <textarea placeholder="Escribe un mensaje..." value={message} onChange={function (e) {
                setMessage(e.target.value);
                var textarea = e.target;
                setTimeout(function () {
                    textarea.style.height = 'auto';
                    var newHeight = Math.min(textarea.scrollHeight, 120);
                    textarea.style.height = "".concat(newHeight, "px");
                }, 0);
            }} onKeyPress={function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }} className="flex-1 bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 resize-none min-h-[24px] max-h-[120px] py-1" rows={1}/>
              <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors" onClick={function () { return setShowEmojiPicker(function (v) { return !v; }); }}>
                  <lucide_react_1.Smile size={20} className="text-gray-600 dark:text-gray-300"/>
                </button>
                {showEmojiPicker && (<div className="absolute bottom-full mb-2 right-0 z-50 animate-slideInUp">
                    <emoji_picker_react_1.default onEmojiClick={handleEmojiClick}/>
                  </div>)}
              </div>
            </div>

            <button onClick={handleSendMessage} className="p-3 text-white rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg" style={{
                backgroundImage: "linear-gradient(to right, ".concat(themeColors[theme].hex, ", #14b8a6)")
            }}>
              <lucide_react_1.Send size={20}/>
            </button>
          </div>
        </div>
        </div>
        </>)}
      </div>

      {/* Panel lateral de información (toggleable) */}
      {showInfo && currentChat && (<div className={"w-80 border-l p-6 pt-12 relative overflow-y-auto ".concat(infoPanelClosing ? 'animate-slideOutRight' : 'animate-slideInRight')} style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                borderColor: darkMode ? '#374151' : '#e5e7eb'
            }}>
          <button aria-label="Cerrar panel" className="absolute top-4 right-4 p-2 rounded-full transition" onClick={closeInfoPanel} style={{ color: darkMode ? '#9ca3af' : '#4b5563', backgroundColor: darkMode ? '#374151' : '#f3f4f6' }}>
            <lucide_react_1.X className="w-4 h-4"/>
          </button>
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-semibold mb-4" style={{
                backgroundImage: "linear-gradient(135deg, ".concat(themeColors[theme].hex, ", #14b8a6)")
            }}>
              {currentChat.avatar}
            </div>
            {editingName ? (<div className="flex items-center gap-2">
                <input type="text" value={tempName} onChange={function (e) { return setTempName(e.target.value); }} onKeyPress={function (e) { return e.key === 'Enter' && saveEditName(); }} className="flex-1 px-3 py-1 rounded-md border focus:outline-none text-center font-semibold" style={{
                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                    borderColor: darkMode ? '#4b5563' : '#d1d5db',
                    color: darkMode ? '#f3f4f6' : '#111827'
                }} autoFocus/>
                <button onClick={saveEditName} className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded">
                  <lucide_react_1.Check size={18} className="text-green-600"/>
                </button>
                <button onClick={cancelEditName} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                  <lucide_react_1.X size={18} className="text-red-600"/>
                </button>
              </div>) : (<div className="flex items-center justify-center gap-2">
                <h3 className="text-xl font-semibold mb-1" style={{ color: darkMode ? '#f3f4f6' : '#111827' }}>{currentChat.name}</h3>
                <button onClick={startEditName} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100">
                  <lucide_react_1.Copy size={14} style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}/>
                </button>
              </div>)}
            <p style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>+54 9 11 1234-5678</p>
          </div>

          <div className="space-y-4">
            {/* Datos del Padrón */}
            <div className="rounded-lg p-4 border" style={{
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: darkMode ? '#e5e7eb' : '#1f2937' }}>Datos del Padrón</h4>
              <div className="space-y-3 text-sm">
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Nº Padrón / Cuenta</label>
                  <input type="number" value={((_b = currentChat.padron) === null || _b === void 0 ? void 0 : _b.number) || ''} onChange={function (e) { return updatePadronField('number', e.target.value); }} className="w-full px-3 py-2 rounded-md border focus:outline-none transition" style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                borderColor: darkMode ? '#4b5563' : '#d1d5db',
                color: darkMode ? '#f3f4f6' : '#111827',
                boxShadow: 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 0 #0000'
            }} onFocus={function (e) { return e.currentTarget.style.boxShadow = "0 0 0 3px ".concat(themeColors[theme].hex, "40"); }} onBlur={function (e) { return e.currentTarget.style.boxShadow = ''; }}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Ubicación</label>
                  <input type="text" value={((_c = currentChat.padron) === null || _c === void 0 ? void 0 : _c.location) || ''} onChange={function (e) { return updatePadronField('location', e.target.value); }} className="w-full px-3 py-2 rounded-md border focus:outline-none transition" style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                borderColor: darkMode ? '#4b5563' : '#d1d5db',
                color: darkMode ? '#f3f4f6' : '#111827'
            }} onFocus={function (e) { return e.currentTarget.style.boxShadow = "0 0 0 3px ".concat(themeColors[theme].hex, "40"); }} onBlur={function (e) { return e.currentTarget.style.boxShadow = ''; }}/>
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Estado Deuda</label>
                  <select value={((_d = currentChat.padron) === null || _d === void 0 ? void 0 : _d.debtStatus) || 'Al Día'} onChange={function (e) { return updatePadronField('debtStatus', e.target.value); }} className="w-full px-3 py-2 rounded-md border focus:outline-none transition" style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                borderColor: darkMode ? '#4b5563' : '#d1d5db',
                color: darkMode ? '#f3f4f6' : '#111827'
            }} onFocus={function (e) { return e.currentTarget.style.boxShadow = "0 0 0 3px ".concat(themeColors[theme].hex, "40"); }} onBlur={function (e) { return e.currentTarget.style.boxShadow = ''; }}>
                    <option value="Al Día">🟢 Al Día</option>
                    <option value="Con Deuda">🔴 Con Deuda</option>
                    <option value="Plan de Pago">🟡 Plan de Pago</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notas Internas */}
            <div className="border rounded-lg p-4" style={{
                backgroundColor: darkMode ? '#374151' : '#fffbeb',
                borderColor: darkMode ? '#d97706' : '#fcd34d'
            }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold" style={{ color: darkMode ? '#fbbf24' : '#92400e' }}>Notas Privadas 🔒</h4>
                <span className="text-xs" style={{ color: darkMode ? '#f59e0b' : '#b45309' }}>Solo internos</span>
              </div>
              <div className="space-y-2 mb-3">
                {(currentChat.notes || []).map(function (note) { return (<div key={note.id} className="border rounded-md p-2 flex justify-between items-start transition" style={{
                    backgroundColor: darkMode ? '#1f2937' : '#fef3c7',
                    borderColor: darkMode ? '#92400e' : '#fcd34d',
                    color: darkMode ? '#fbbf24' : '#92400e'
                }}>
                    <span className="text-sm leading-tight">{note.text}</span>
                    <button className="p-1 rounded-md transition" onClick={function () { return deleteNote(note.id); }} style={{ backgroundColor: darkMode ? '#374151' : '#fed7aa', color: darkMode ? '#fbbf24' : '#b45309' }}>
                      <lucide_react_1.Trash size={14}/>
                    </button>
                  </div>); })}
                {(currentChat.notes || []).length === 0 && (<p className="text-sm" style={{ color: darkMode ? '#f59e0b' : '#b45309' }}>Sin notas aún.</p>)}
              </div>
              <div className="space-y-2">
                <textarea placeholder="Nueva nota privada" value={noteDrafts[currentChat.id] || ''} onChange={function (e) { return setNoteDrafts(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[currentChat.id] = e.target.value, _a)));
        }); }} className="w-full h-16 px-3 py-2 rounded-md border focus:outline-none transition" style={{
                backgroundColor: darkMode ? '#1f2937' : '#fffbeb',
                borderColor: darkMode ? '#92400e' : '#fcd34d',
                color: darkMode ? '#9ca3af' : '#6b7280'
            }} onFocus={function (e) { return e.currentTarget.style.boxShadow = "0 0 0 3px ".concat(themeColors[theme].hex, "40"); }} onBlur={function (e) { return e.currentTarget.style.boxShadow = ''; }}/>
                <button className="w-full px-3 py-2 rounded-md text-white font-semibold transition" onClick={addNote} style={{ backgroundColor: themeColors[theme].hex }} onMouseEnter={function (e) { return e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={function (e) { return e.currentTarget.style.opacity = '1'; }}>
                  Guardar Nota
                </button>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Estado</h4>
              <div className="flex items-center gap-2">
                <div className={"w-2 h-2 rounded-full ".concat(currentChat.status === 'online' ? 'bg-green-500' : 'bg-gray-400')}></div>
                <span className="text-sm" style={{ color: darkMode ? '#d1d5db' : '#4b5563' }}>
                  {currentChat.status === 'online' ? 'En línea' : 'Desconectado'}
                </span>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-3" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Etiquetas</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs transition" style={{
                backgroundColor: darkMode ? '#3b82f620' : '#dbeafe',
                color: darkMode ? '#60a5fa' : '#1e40af'
            }}>Cliente nuevo</span>
                <span className="px-3 py-1 rounded-full text-xs transition" style={{
                backgroundColor: darkMode ? '#a855f720' : '#e9d5ff',
                color: darkMode ? '#d8b4fe' : '#6b21a8'
            }}>Consulta</span>
              </div>
            </div>

            <div className="rounded-lg p-4 border" style={{
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Información</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Primera vez:</span>
                  <span style={{ color: darkMode ? '#e5e7eb' : '#111827' }}>Hace 2 días</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Mensajes:</span>
                  <span style={{ color: darkMode ? '#e5e7eb' : '#111827' }}>{currentChat.messages.length}</span>
                </div>
              </div>
            </div>

            {/* Archivos Multimedia */}
            <div className="rounded-lg p-4 border" style={{
                backgroundColor: darkMode ? '#374151' : '#f9fafb',
                borderColor: darkMode ? '#4b5563' : '#e5e7eb'
            }}>
              <button onClick={function () { return setShowMediaMenu(!showMediaMenu); }} className="w-full flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold" style={{ color: darkMode ? '#e5e7eb' : '#374151' }}>Archivos Multimedia</h4>
                <lucide_react_1.ChevronUp size={18} className={"transition-transform ".concat(showMediaMenu ? 'rotate-180' : '')} style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}/>
              </button>

              {showMediaMenu && (<div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'images', 'videos', 'files', 'urls'].map(function (filter) { return (<button key={filter} onClick={function () { return setMediaFilter(filter); }} className="px-3 py-1 rounded-full text-xs transition" style={{
                        backgroundColor: mediaFilter === filter ? themeColors[theme].hex : (darkMode ? '#4b5563' : '#e5e7eb'),
                        color: mediaFilter === filter ? '#ffffff' : (darkMode ? '#d1d5db' : '#4b5563')
                    }}>
                        {filter === 'all' ? 'Todos' : filter === 'images' ? 'Imágenes' : filter === 'videos' ? 'Videos' : filter === 'files' ? 'Archivos' : 'URLs'}
                      </button>); })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                    {getMediaMessages().map(function (msg) {
                    var _a;
                    return (<div key={msg.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition border" style={{ borderColor: darkMode ? '#4b5563' : '#d1d5db' }} onClick={function () {
                            if (msg.type === 'image')
                                setLightboxImage(msg.fileUrl);
                        }}>
                        {msg.type === 'image' ? (<img src={msg.fileUrl} alt={msg.text} className="w-full h-full object-cover"/>) : msg.type === 'video' ? (<div className="relative w-full h-full bg-black">
                            <video src={msg.fileUrl} className="w-full h-full object-cover" preload="metadata"/>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <lucide_react_1.Play size={24} className="text-white"/>
                            </div>
                          </div>) : msg.type === 'file' ? ((function () {
                            var _a;
                            var isPdf = (_a = msg.filename) === null || _a === void 0 ? void 0 : _a.toLowerCase().endsWith('.pdf');
                            var isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.filename || '');
                            if (isPdf && msg.fileUrl) {
                                return (<div className="relative w-full h-full">
                                  <iframe src={"".concat(msg.fileUrl, "#page=1&toolbar=0&navpanes=0&scrollbar=0")} className="w-full h-full pointer-events-none" style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}/>
                                  <div className="absolute inset-0 flex items-end justify-center pb-2 bg-gradient-to-t from-black/60 to-transparent">
                                    <span className="text-xs text-white font-medium">PDF</span>
                                  </div>
                                </div>);
                            }
                            else if (isImage && msg.fileUrl) {
                                return <img src={msg.fileUrl} alt={msg.text} className="w-full h-full object-cover"/>;
                            }
                            else {
                                return (<div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center p-2">
                                  <lucide_react_1.FileText size={24} className="text-emerald-600 mb-1"/>
                                  <span className="text-xs text-center truncate w-full" style={{ color: darkMode ? '#d1d5db' : '#4b5563' }}>
                                    {msg.filename}
                                  </span>
                                </div>);
                            }
                        })()) : (<div className="w-full h-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center p-2">
                            <span className="text-xs text-center break-all text-blue-600 dark:text-blue-300">
                              {(_a = msg.text.match(/https?:\/\/[^\s]+/)) === null || _a === void 0 ? void 0 : _a[0]}
                            </span>
                          </div>)}
                      </div>);
                })}
                  </div>

                  {getMediaMessages().length === 0 && (<p className="text-xs text-center py-4" style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                      No hay archivos multimedia
                    </p>)}
                </div>)}
            </div>
          </div>
        </div>)}

      {/* Custom Context Menu */}
      {contextMenu.visible && (<div ref={contextMenuRef} className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg animate-slideInUp" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={function (e) { return e.stopPropagation(); }}>
          {contextMenu.type === 'chat' && (<div className="py-1 w-56">
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { setSelectedChat(conversationsState.findIndex(function (c) { return c.id === contextMenu.targetId; })); setChatClosed(false); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Abrir</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return markChatReadById(contextMenu.targetId); }}>Marcar como leída</button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return archiveConversationById(contextMenu.targetId); }}>Archivar</button>
              <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={function () { return deleteConversationById(contextMenu.targetId); }}>Eliminar</button>
            </div>)}
          {contextMenu.type === 'message' && (function () {
                var msg = selectedChat !== null ? conversationsState[selectedChat].messages.find(function (m) { return m.id === contextMenu.targetId; }) : null;
                var isOwnMessage = (msg === null || msg === void 0 ? void 0 : msg.sent) === true;
                return (<div className="py-1 w-48">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return replyToMessage(contextMenu.targetId); }}>Responder</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return copyMessageById(contextMenu.targetId); }}>Copiar</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return forwardMessage(contextMenu.targetId); }}>Reenviar</button>
                {isOwnMessage && (<button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { return startEditMessage(contextMenu.targetId); }}>Editar</button>)}
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={function () { return deleteMessageById(contextMenu.targetId); }}>Eliminar</button>
              </div>);
            })()}
          {contextMenu.type === 'blank' && (<div className="py-1 w-56">
              {!selectionMode ? (<button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={startSelection}>Seleccionar mensajes</button>) : (<>
                  <button className={"w-full text-left px-3 py-2 ".concat(selectedMessageIds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700')} onClick={function () { if (selectedMessageIds.length > 0)
                    deleteSelectedMessages(); }}>
                    Eliminar seleccionados
                  </button>
                  <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={exitSelection}>Salir de selección</button>
                </>)}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={function () { setSelectedChat(null); setChatClosed(true); setContextMenu({ visible: false, x: 0, y: 0, type: null }); }}>Cerrar chat</button>
            </div>)}
        </div>)}

      {/* Confirmation Modal */}
      {confirmDialog && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 animate-slideInUp">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirmación</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onClick={function () { return setConfirmDialog(null); }}>
                Cancelar
              </button>
              <button className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors" onClick={confirmDialog.onConfirm}>
                Eliminar
              </button>
            </div>
          </div>
        </div>)}

      {/* Preferences Modal */}
      {showPreferences && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div ref={preferencesRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-h-96 overflow-y-auto animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preferencias</h2>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={function () { return setShowPreferences(false); }}>
                <lucide_react_1.X className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
              </button>
            </div>

            {/* Theme Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">Tema de Color</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(themeColors).map(function (_a) {
                var key = _a[0], colors = _a[1];
                return (<button key={key} onClick={function () { return setTheme(key); }} className={"p-3 rounded-lg border-2 transition-all ".concat(theme === key
                        ? 'border-gray-900 dark:border-gray-100'
                        : 'border-gray-200 dark:border-gray-700')} style={{ backgroundColor: colors.hex }} title={key.charAt(0).toUpperCase() + key.slice(1)}>
                    {theme === key && <lucide_react_1.Check className="w-4 h-4 text-white mx-auto"/>}
                  </button>);
            })}
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Modo Oscuro</label>
              <button onClick={function () { return setDarkMode(!darkMode); }} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{
                backgroundColor: darkMode ? themeColors[theme].hex : '#d1d5db'
            }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{
                transform: darkMode ? 'translateX(24px)' : 'translateX(4px)'
            }}/>
              </button>
            </div>

            {/* Background Pattern Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Patrón de Fondo</label>
              <button onClick={function () { return setBackgroundPattern(!backgroundPattern); }} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{
                backgroundColor: backgroundPattern ? themeColors[theme].hex : '#d1d5db'
            }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{
                transform: backgroundPattern ? 'translateX(24px)' : 'translateX(4px)'
            }}/>
              </button>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Sonidos</label>
              <button onClick={function () { return setSoundEnabled(!soundEnabled); }} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors" style={{
                backgroundColor: soundEnabled ? themeColors[theme].hex : '#d1d5db'
            }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{
                transform: soundEnabled ? 'translateX(24px)' : 'translateX(4px)'
            }}/>
              </button>
            </div>
          </div>
        </div>)}

      {/* Nueva Conversación Modal */}
      {showNewConversation && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nueva Conversación</h2>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={function () {
                setShowNewConversation(false);
                setNewConvName('');
                setNewConvPhone('');
                setNewConvMessage('');
            }}>
                <lucide_react_1.X className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nombre</label>
                <input type="text" value={newConvName} onChange={function (e) { return setNewConvName(e.target.value); }} placeholder="Ingresa el nombre" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Teléfono</label>
                <input type="tel" value={newConvPhone} onChange={function (e) { return setNewConvPhone(e.target.value); }} placeholder="+54 9 11 1234-5678" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Mensaje inicial (opcional)</label>
                <textarea value={newConvMessage} onChange={function (e) { return setNewConvMessage(e.target.value); }} placeholder="Escribe un mensaje..." rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"/>
              </div>

              <button onClick={createNewConversation} disabled={!newConvName.trim() || !newConvPhone.trim()} className={"w-full py-2 px-4 rounded-lg font-medium transition-colors ".concat(newConvName.trim() && newConvPhone.trim()
                ? "bg-".concat(themeColors[theme].primary, " hover:opacity-90 text-white")
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed')} style={newConvName.trim() && newConvPhone.trim() ? { backgroundColor: themeColors[theme].hex } : {}}>
                Crear Conversación
              </button>
            </div>
          </div>
        </div>)}

      {/* Conversaciones Archivadas Modal */}
      {showArchived && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-[500px] max-h-[600px] animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conversaciones Archivadas</h2>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={function () { return setShowArchived(false); }}>
                <lucide_react_1.X className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[450px] space-y-2">
              {archivedConversations.length === 0 ? (<div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay conversaciones archivadas
                </div>) : (archivedConversations.map(function (conv) { return (<div key={conv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: themeColors[theme].hex }}>
                        {conv.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{conv.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</div>
                      </div>
                    </div>
                    <button onClick={function () { return unarchiveConversationById(conv.id); }} className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
                      Desarchivar
                    </button>
                  </div>); }))}
            </div>
          </div>
        </div>)}

      {/* Modal de Reenvío */}
      {showForwardMenu && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-[400px] max-h-[500px] animate-slideInUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reenviar mensaje a:</h2>
              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={function () { setShowForwardMenu(false); setForwardMessageId(null); }}>
                <lucide_react_1.X className="w-5 h-5 text-gray-600 dark:text-gray-300"/>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[350px] space-y-2">
              {conversationsState.filter(function (c) { return !c.archived; }).map(function (conv) { return (<button key={conv.id} onClick={function () { return confirmForward(conv.id); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ backgroundColor: themeColors[theme].hex }}>
                    {conv.avatar}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{conv.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</div>
                  </div>
                </button>); })}
            </div>
          </div>
        </div>)}
      </div>

      {/* Lightbox Modal para imágenes */}
      {lightboxImage && (<div className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn" style={{ backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }} onClick={function () { setLightboxImage(null); setLightboxMessageId(null); setImageZoom(1); setImageRotation(0); }}>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg p-2 backdrop-blur-sm" style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}>
            <button onClick={function (e) { e.stopPropagation(); setImageZoom(Math.max(0.5, imageZoom - 0.25)); }} className="p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827', backgroundColor: 'transparent' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Alejar">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <span className="text-sm font-medium min-w-[60px] text-center" style={{ color: darkMode ? '#f3f4f6' : '#111827' }}>{Math.round(imageZoom * 100)}%</span>
            <button onClick={function (e) { e.stopPropagation(); setImageZoom(Math.min(3, imageZoom + 0.25)); }} className="p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Acercar">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <div className="w-px h-6 bg-white/20"></div>
            <button onClick={function (e) { e.stopPropagation(); setImageRotation((imageRotation - 90) % 360); }} className="p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Rotar izquierda">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"></path>
              </svg>
            </button>
            <button onClick={function (e) { e.stopPropagation(); setImageRotation((imageRotation + 90) % 360); }} className="p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Rotar derecha">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"></path>
              </svg>
            </button>
            <div className="w-px h-6" style={{ backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }}></div>
            <a href={lightboxImage} download onClick={function (e) { return e.stopPropagation(); }} className="p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Descargar">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>

          {/* Botones de acciones de mensaje */}
          {lightboxMessageId && (<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 sm:gap-2 rounded-lg p-2 backdrop-blur-sm max-w-[90vw]" style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}>
              <button onClick={function (e) { e.stopPropagation(); replyFromLightbox(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Responder">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4"></polyline>
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Responder</span>
              </button>
              <button onClick={function (e) { e.stopPropagation(); goToMessage(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Ir al mensaje">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span className="font-medium hidden sm:inline">Ir al mensaje</span>
              </button>
              <button onClick={function (e) { e.stopPropagation(); forwardFromLightbox(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Reenviar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 14 20 9 15 4"></polyline>
                  <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Reenviar</span>
              </button>
            </div>)}

          <button onClick={function () { setLightboxImage(null); setLightboxMessageId(null); setImageZoom(1); setImageRotation(0); }} className="absolute top-4 right-4 p-2 rounded-lg transition-colors" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <lucide_react_1.X size={24}/>
          </button>
          <img src={lightboxImage} alt="full-resolution" className="max-w-[90vw] sm:max-w-4xl max-h-[80vh] sm:max-h-screen object-contain animate-slideInUp transition-transform duration-200" style={{
                transform: "scale(".concat(imageZoom, ") rotate(").concat(imageRotation, "deg)"),
                cursor: imageZoom > 1 ? 'move' : 'default'
            }} onClick={function (e) { return e.stopPropagation(); }}/>
        </div>)}

      {/* Reproductor de Video Modal */}
      {lightboxVideo && (<div className="fixed inset-0 flex items-center justify-center z-50 animate-fadeIn" style={{ backgroundColor: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)' }} onClick={function () { setLightboxVideo(null); setLightboxMessageId(null); }}>
          <button onClick={function () { setLightboxVideo(null); setLightboxMessageId(null); }} className="absolute top-4 right-4 p-2 rounded-lg transition-colors z-10" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <lucide_react_1.X size={24}/>
          </button>
          
          {/* Botones de acciones de mensaje */}
          {lightboxMessageId && (<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1 sm:gap-2 rounded-lg p-2 backdrop-blur-sm z-10 max-w-[90vw]" style={{ backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)' }}>
              <button onClick={function (e) { e.stopPropagation(); replyFromLightbox(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Responder">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4"></polyline>
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Responder</span>
              </button>
              <button onClick={function (e) { e.stopPropagation(); goToMessage(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Ir al mensaje">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span className="font-medium hidden sm:inline">Ir al mensaje</span>
              </button>
              <button onClick={function (e) { e.stopPropagation(); forwardFromLightbox(lightboxMessageId); }} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm" style={{ color: darkMode ? '#f3f4f6' : '#111827' }} onMouseEnter={function (e) { return e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'; }} onMouseLeave={function (e) { return e.currentTarget.style.backgroundColor = 'transparent'; }} title="Reenviar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 14 20 9 15 4"></polyline>
                  <path d="M4 20v-7a4 4 0 0 1 4-4h12"></path>
                </svg>
                <span className="font-medium hidden sm:inline">Reenviar</span>
              </button>
            </div>)}
          
          <div className="w-[90vw] sm:w-full max-w-5xl mx-4 animate-slideInUp" onClick={function (e) { return e.stopPropagation(); }}>
            <video src={lightboxVideo} controls autoPlay className="w-full rounded-lg shadow-2xl" style={{ maxHeight: '85vh' }}/>
          </div>
        </div>)}
    </div>);
}
