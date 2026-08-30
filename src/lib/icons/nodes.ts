import type { IconNode } from "./types";

// Lucide icon path data, lifted verbatim from the original extension's bundle so the glyphs are
// pixel-identical. One `const` per icon keeps the set tree-shakeable: only the icons a module
// actually imports reach the output.

export const Aperture: IconNode = [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", { d: "m14.31 8 5.74 9.94" }],
  ["path", { d: "M9.69 8h11.48" }],
  ["path", { d: "m7.38 12 5.74-9.94" }],
  ["path", { d: "M9.69 16 3.95 6.06" }],
  ["path", { d: "M14.31 16H2.83" }],
  ["path", { d: "m16.62 12-5.74 9.94" }]
];

export const Bolt: IconNode = [
  ["path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }],
  ["circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }]
];

export const BookmarkPlus: IconNode = [
  ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" }],
  ["line", {
    x1: "12",
    x2: "12",
    y1: "7",
    y2: "13"
  }],
  ["line", {
    x1: "15",
    x2: "9",
    y1: "10",
    y2: "10"
  }]
];

export const Bot: IconNode = [
  ["path", { d: "M12 8V4H8" }],
  ["rect", {
    width: "16",
    height: "12",
    x: "4",
    y: "8",
    rx: "2"
  }],
  ["path", { d: "M2 14h2" }],
  ["path", { d: "M20 14h2" }],
  ["path", { d: "M15 13v2" }],
  ["path", { d: "M9 13v2" }]
];

export const Brain: IconNode = [
  ["path", { d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" }],
  ["path", { d: "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" }],
  ["path", { d: "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" }],
  ["path", { d: "M17.599 6.5a3 3 0 0 0 .399-1.375" }],
  ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5" }],
  ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396" }],
  ["path", { d: "M19.938 10.5a4 4 0 0 1 .585.396" }],
  ["path", { d: "M6 18a4 4 0 0 1-1.967-.516" }],
  ["path", { d: "M19.967 17.484A4 4 0 0 1 18 18" }]
];

export const Briefcase: IconNode = [
  ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" }],
  ["rect", {
    width: "20",
    height: "14",
    x: "2",
    y: "6",
    rx: "2"
  }]
];

export const Bug: IconNode = [
  ["path", { d: "m8 2 1.88 1.88" }],
  ["path", { d: "M14.12 3.88 16 2" }],
  ["path", { d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" }],
  ["path", { d: "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" }],
  ["path", { d: "M12 20v-9" }],
  ["path", { d: "M6.53 9C4.6 8.8 3 7.1 3 5" }],
  ["path", { d: "M6 13H2" }],
  ["path", { d: "M3 21c0-2.1 1.7-3.9 3.8-4" }],
  ["path", { d: "M20.97 5c0 2.1-1.6 3.8-3.5 4" }],
  ["path", { d: "M22 13h-4" }],
  ["path", { d: "M17.2 17c2.1.1 3.8 1.9 3.8 4" }]
];

export const Camera: IconNode = [
  ["path", { d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" }],
  ["circle", {
    cx: "12",
    cy: "13",
    r: "3"
  }]
];

export const Cctv: IconNode = [
  ["path", { d: "M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97" }],
  ["path", { d: "M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z" }],
  ["path", { d: "M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15" }],
  ["path", { d: "M2 21v-4" }],
  ["path", { d: "M7 9h.01" }]
];

export const ChartNoAxesCombined: IconNode = [
  ["path", { d: "M12 16v5" }],
  ["path", { d: "M16 14v7" }],
  ["path", { d: "M20 10v11" }],
  ["path", { d: "m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15" }],
  ["path", { d: "M4 18v3" }],
  ["path", { d: "M8 14v7" }]
];

export const ChevronDown: IconNode = [
  ["path", { d: "m6 9 6 6 6-6" }]
];

export const ChevronRight: IconNode = [
  ["path", { d: "m9 18 6-6-6-6" }]
];

export const ChevronUp: IconNode = [
  ["path", { d: "m18 15-6-6-6 6" }]
];

export const CircleHelp: IconNode = [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
  ["path", { d: "M12 17h.01" }]
];

export const ClipboardList: IconNode = [
  ["rect", {
    width: "8",
    height: "4",
    x: "8",
    y: "2",
    rx: "1",
    ry: "1"
  }],
  ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
  ["path", { d: "M12 11h4" }],
  ["path", { d: "M12 16h4" }],
  ["path", { d: "M8 11h.01" }],
  ["path", { d: "M8 16h.01" }]
];

export const Cloud: IconNode = [
  ["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }]
];

export const CloudLightning: IconNode = [
  ["path", { d: "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" }],
  ["path", { d: "m13 12-3 5h4l-3 5" }]
];

export const CloudRain: IconNode = [
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" }],
  ["path", { d: "M16 14v6" }],
  ["path", { d: "M8 14v6" }],
  ["path", { d: "M12 16v6" }]
];

export const CloudSnow: IconNode = [
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" }],
  ["path", { d: "M8 15h.01" }],
  ["path", { d: "M8 19h.01" }],
  ["path", { d: "M12 17h.01" }],
  ["path", { d: "M12 21h.01" }],
  ["path", { d: "M16 15h.01" }],
  ["path", { d: "M16 19h.01" }]
];

export const Code: IconNode = [
  ["path", { d: "m16 18 6-6-6-6" }],
  ["path", { d: "m8 6-6 6 6 6" }]
];

export const Coffee: IconNode = [
  ["path", { d: "M10 2v2" }],
  ["path", { d: "M14 2v2" }],
  ["path", { d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" }],
  ["path", { d: "M6 2v2" }]
];

export const Cog: IconNode = [
  ["path", { d: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" }],
  ["path", { d: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" }],
  ["path", { d: "M12 2v2" }],
  ["path", { d: "M12 22v-2" }],
  ["path", { d: "m17 20.66-1-1.73" }],
  ["path", { d: "M11 10.27 7 3.34" }],
  ["path", { d: "m20.66 17-1.73-1" }],
  ["path", { d: "m3.34 7 1.73 1" }],
  ["path", { d: "M14 12h8" }],
  ["path", { d: "M2 12h2" }],
  ["path", { d: "m20.66 7-1.73 1" }],
  ["path", { d: "m3.34 17 1.73-1" }],
  ["path", { d: "m17 3.34-1 1.73" }],
  ["path", { d: "m11 13.73-4 6.93" }]
];

export const Copy: IconNode = [
  ["rect", {
    width: "14",
    height: "14",
    x: "8",
    y: "8",
    rx: "2",
    ry: "2"
  }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]
];

export const DollarSign: IconNode = [
  ["line", {
    x1: "12",
    x2: "12",
    y1: "2",
    y2: "22"
  }],
  ["path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" }]
];

export const Download: IconNode = [
  ["path", { d: "M12 15V3" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
  ["path", { d: "m7 10 5 5 5-5" }]
];

export const Earth: IconNode = [
  ["path", { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54" }],
  ["path", { d: "M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" }],
  ["path", { d: "M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" }],
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }]
];

export const ExternalLink: IconNode = [
  ["path", { d: "M15 3h6v6" }],
  ["path", { d: "M10 14 21 3" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]
];

export const Eye: IconNode = [
  ["path", { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }],
  ["circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }]
];

export const EyeOff: IconNode = [
  ["path", { d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" }],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }],
  ["path", { d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" }],
  ["path", { d: "m2 2 20 20" }]
];

export const FileText: IconNode = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
  ["path", { d: "M10 9H8" }],
  ["path", { d: "M16 13H8" }],
  ["path", { d: "M16 17H8" }]
];

export const Fingerprint: IconNode = [
  ["path", { d: "M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" }],
  ["path", { d: "M14 13.12c0 2.38 0 6.38-1 8.88" }],
  ["path", { d: "M17.29 21.02c.12-.6.43-2.3.5-3.02" }],
  ["path", { d: "M2 12a10 10 0 0 1 18-6" }],
  ["path", { d: "M2 16h.01" }],
  ["path", { d: "M21.8 16c.2-2 .131-5.354 0-6" }],
  ["path", { d: "M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" }],
  ["path", { d: "M8.65 22c.21-.66.45-1.32.57-2" }],
  ["path", { d: "M9 6.8a6 6 0 0 1 9 5.2v2" }]
];

export const Flag: IconNode = [
  ["path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" }],
  ["line", {
    x1: "4",
    x2: "4",
    y1: "22",
    y2: "15"
  }]
];

export const Gamepad2: IconNode = [
  ["line", {
    x1: "6",
    x2: "10",
    y1: "11",
    y2: "11"
  }],
  ["line", {
    x1: "8",
    x2: "8",
    y1: "9",
    y2: "13"
  }],
  ["line", {
    x1: "15",
    x2: "15.01",
    y1: "12",
    y2: "12"
  }],
  ["line", {
    x1: "18",
    x2: "18.01",
    y1: "10",
    y2: "10"
  }],
  ["path", { d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" }]
];

export const Gem: IconNode = [
  ["path", { d: "M6 3h12l4 6-10 13L2 9Z" }],
  ["path", { d: "M11 3 8 9l4 13 4-13-3-6" }],
  ["path", { d: "M2 9h20" }]
];

export const Globe: IconNode = [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
  ["path", { d: "M2 12h20" }]
];

export const Grip: IconNode = [
  ["circle", {
    cx: "12",
    cy: "5",
    r: "1"
  }],
  ["circle", {
    cx: "19",
    cy: "5",
    r: "1"
  }],
  ["circle", {
    cx: "5",
    cy: "5",
    r: "1"
  }],
  ["circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "5",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "12",
    cy: "19",
    r: "1"
  }],
  ["circle", {
    cx: "19",
    cy: "19",
    r: "1"
  }],
  ["circle", {
    cx: "5",
    cy: "19",
    r: "1"
  }]
];

export const GripVertical: IconNode = [
  ["circle", {
    cx: "9",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "9",
    cy: "5",
    r: "1"
  }],
  ["circle", {
    cx: "9",
    cy: "19",
    r: "1"
  }],
  ["circle", {
    cx: "15",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "15",
    cy: "5",
    r: "1"
  }],
  ["circle", {
    cx: "15",
    cy: "19",
    r: "1"
  }]
];

export const Hamburger: IconNode = [
  ["path", { d: "M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25" }],
  ["path", { d: "M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2" }],
  ["path", { d: "M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0" }],
  ["path", { d: "m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" }]
];

export const Heart: IconNode = [
  ["path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }]
];

export const House: IconNode = [
  ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
  ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }]
];

export const Image: IconNode = [
  ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2",
    ry: "2"
  }],
  ["circle", {
    cx: "9",
    cy: "9",
    r: "2"
  }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }]
];

export const Info: IconNode = [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }],
  ["path", { d: "M12 16v-4" }],
  ["path", { d: "M12 8h.01" }]
];

export const Mail: IconNode = [
  ["path", { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" }],
  ["rect", {
    x: "2",
    y: "4",
    width: "20",
    height: "16",
    rx: "2"
  }]
];

export const Map: IconNode = [
  ["path", { d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" }],
  ["path", { d: "M15 5.764v15" }],
  ["path", { d: "M9 3.236v15" }]
];

export const MapPin: IconNode = [
  ["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }],
  ["circle", {
    cx: "12",
    cy: "10",
    r: "3"
  }]
];

export const MessageCircle: IconNode = [
  ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z" }]
];

export const Monitor: IconNode = [
  ["rect", {
    width: "20",
    height: "14",
    x: "2",
    y: "3",
    rx: "2"
  }],
  ["line", {
    x1: "8",
    x2: "16",
    y1: "21",
    y2: "21"
  }],
  ["line", {
    x1: "12",
    x2: "12",
    y1: "17",
    y2: "21"
  }]
];

export const Music: IconNode = [
  ["path", { d: "M9 18V5l12-2v13" }],
  ["circle", {
    cx: "6",
    cy: "18",
    r: "3"
  }],
  ["circle", {
    cx: "18",
    cy: "16",
    r: "3"
  }]
];

export const Newspaper: IconNode = [
  ["path", { d: "M15 18h-5" }],
  ["path", { d: "M18 14h-8" }],
  ["path", { d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" }],
  ["rect", {
    width: "8",
    height: "4",
    x: "10",
    y: "6",
    rx: "1"
  }]
];

export const Palette: IconNode = [
  ["path", { d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" }],
  ["circle", {
    cx: "13.5",
    cy: "6.5",
    r: ".5",
    fill: "currentColor"
  }],
  ["circle", {
    cx: "17.5",
    cy: "10.5",
    r: ".5",
    fill: "currentColor"
  }],
  ["circle", {
    cx: "6.5",
    cy: "12.5",
    r: ".5",
    fill: "currentColor"
  }],
  ["circle", {
    cx: "8.5",
    cy: "7.5",
    r: ".5",
    fill: "currentColor"
  }]
];

export const PawPrint: IconNode = [
  ["circle", {
    cx: "11",
    cy: "4",
    r: "2"
  }],
  ["circle", {
    cx: "18",
    cy: "8",
    r: "2"
  }],
  ["circle", {
    cx: "20",
    cy: "16",
    r: "2"
  }],
  ["path", { d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" }]
];

export const Phone: IconNode = [
  ["path", { d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" }]
];

export const Plus: IconNode = [
  ["path", { d: "M5 12h14" }],
  ["path", { d: "M12 5v14" }]
];

export const Podcast: IconNode = [
  ["path", { d: "M16.85 18.58a9 9 0 1 0-9.7 0" }],
  ["path", { d: "M8 14a5 5 0 1 1 8 0" }],
  ["circle", {
    cx: "12",
    cy: "11",
    r: "1"
  }],
  ["path", { d: "M13 17a1 1 0 1 0-2 0l.5 4.5a.5.5 0 1 0 1 0Z" }]
];

export const Popcorn: IconNode = [
  ["path", { d: "M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4" }],
  ["path", { d: "M10 22 9 8" }],
  ["path", { d: "m14 22 1-14" }],
  ["path", { d: "M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z" }]
];

export const Rocket: IconNode = [
  ["path", { d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" }],
  ["path", { d: "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" }],
  ["path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" }],
  ["path", { d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" }]
];

export const Rss: IconNode = [
  ["path", { d: "M4 11a9 9 0 0 1 9 9" }],
  ["path", { d: "M4 4a16 16 0 0 1 16 16" }],
  ["circle", {
    cx: "5",
    cy: "19",
    r: "1"
  }]
];

export const Save: IconNode = [
  ["path", { d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" }],
  ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
  ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }]
];

export const Settings: IconNode = [
  ["path", { d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" }],
  ["circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }]
];

export const Shield: IconNode = [
  ["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }]
];

export const ShoppingBag: IconNode = [
  ["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" }],
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M16 10a4 4 0 0 1-8 0" }]
];

export const ShoppingBasket: IconNode = [
  ["path", { d: "m15 11-1 9" }],
  ["path", { d: "m19 11-4-7" }],
  ["path", { d: "M2 11h20" }],
  ["path", { d: "m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" }],
  ["path", { d: "M4.5 15.5h15" }],
  ["path", { d: "m5 11 4-7" }],
  ["path", { d: "m9 11 1 9" }]
];

export const Skull: IconNode = [
  ["path", { d: "m12.5 17-.5-1-.5 1h1z" }],
  ["path", { d: "M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" }],
  ["circle", {
    cx: "15",
    cy: "12",
    r: "1"
  }],
  ["circle", {
    cx: "9",
    cy: "12",
    r: "1"
  }]
];

export const Sparkles: IconNode = [
  ["path", { d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" }],
  ["path", { d: "M20 3v4" }],
  ["path", { d: "M22 5h-4" }],
  ["path", { d: "M4 17v2" }],
  ["path", { d: "M5 18H3" }]
];

export const Square: IconNode = [
  ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }]
];

export const SquareCheck: IconNode = [
  ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }],
  ["path", { d: "m9 12 2 2 4-4" }]
];

export const SquarePen: IconNode = [
  ["path", { d: "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }],
  ["path", { d: "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" }]
];

export const Star: IconNode = [
  ["path", { d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" }]
];

export const Sun: IconNode = [
  ["circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }],
  ["path", { d: "M12 2v2" }],
  ["path", { d: "M12 20v2" }],
  ["path", { d: "m4.93 4.93 1.41 1.41" }],
  ["path", { d: "m17.66 17.66 1.41 1.41" }],
  ["path", { d: "M2 12h2" }],
  ["path", { d: "M20 12h2" }],
  ["path", { d: "m6.34 17.66-1.41 1.41" }],
  ["path", { d: "m19.07 4.93-1.41 1.41" }]
];

export const Terminal: IconNode = [
  ["path", { d: "M12 19h8" }],
  ["path", { d: "m4 17 6-6-6-6" }]
];

export const Trash2: IconNode = [
  ["path", { d: "M3 6h18" }],
  ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }],
  ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }],
  ["line", {
    x1: "10",
    x2: "10",
    y1: "11",
    y2: "17"
  }],
  ["line", {
    x1: "14",
    x2: "14",
    y1: "11",
    y2: "17"
  }]
];

export const TriangleAlert: IconNode = [
  ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
  ["path", { d: "M12 9v4" }],
  ["path", { d: "M12 17h.01" }]
];

export const TvMinimalPlay: IconNode = [
  ["path", { d: "M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z" }],
  ["path", { d: "M7 21h10" }],
  ["rect", {
    width: "20",
    height: "14",
    x: "2",
    y: "3",
    rx: "2"
  }]
];

export const Upload: IconNode = [
  ["path", { d: "M12 3v12" }],
  ["path", { d: "m17 8-5-5-5 5" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }]
];

export const Video: IconNode = [
  ["path", { d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" }],
  ["rect", {
    x: "2",
    y: "6",
    width: "14",
    height: "12",
    rx: "2"
  }]
];

export const Wallet: IconNode = [
  ["path", { d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" }],
  ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" }]
];

export const WifiOff: IconNode = [
  ["path", { d: "M12 20h.01" }],
  ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0" }],
  ["path", { d: "M5 12.859a10 10 0 0 1 5.17-2.69" }],
  ["path", { d: "M19 12.859a10 10 0 0 0-2.007-1.523" }],
  ["path", { d: "M2 8.82a15 15 0 0 1 4.177-2.643" }],
  ["path", { d: "M22 8.82a15 15 0 0 0-11.288-3.764" }],
  ["path", { d: "m2 2 20 20" }]
];

export const Wind: IconNode = [
  ["path", { d: "M12.8 19.6A2 2 0 1 0 14 16H2" }],
  ["path", { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2" }],
  ["path", { d: "M9.8 4.4A2 2 0 1 1 11 8H2" }]
];

export const XMark: IconNode = [
  ["path", { d: "M18 6 6 18" }],
  ["path", { d: "m6 6 12 12" }]
];

export const Zap: IconNode = [
  ["path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }]
];
