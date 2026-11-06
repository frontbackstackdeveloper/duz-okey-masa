import { writeFileSync } from "node:fs";

const avatars = [
  { id: 3, bg: ["#b5dcc7", "#6ba98d"], skin: "#d99e73", shirt: "#175d53", hair: "#28372f", style: "swoop" },
  { id: 4, bg: ["#f3d6a3", "#d8906f"], skin: "#a96041", shirt: "#743b56", hair: "#281b24", style: "curly" },
  { id: 5, bg: ["#b9d8ed", "#789dbb"], skin: "#edc5a1", shirt: "#354d83", hair: "#503b30", style: "glasses" },
  { id: 6, bg: ["#e6c7d8", "#ba7c9b"], skin: "#b47558", shirt: "#70516f", hair: "#30232b", style: "long" },
  { id: 7, bg: ["#d7ddb0", "#a1b16c"], skin: "#efb88d", shirt: "#6e6240", hair: "#3f2e27", style: "beanie" },
  { id: 8, bg: ["#c7d3e7", "#8190ba"], skin: "#c98a63", shirt: "#2e5b70", hair: "#2b272d", style: "cap" },
];
function accessory(a) {
  if (a.style === "glasses") return '<g fill="none" stroke="#31434e" stroke-width="3.2"><rect x="29" y="56" width="20" height="13" rx="5"/><rect x="55" y="56" width="20" height="13" rx="5"/><path d="M49 61h6"/></g>';
  if (a.style === "beanie") return `<path d="M24 48Q22 17 53 18Q82 18 82 48L76 51H27Z" fill="${a.hair}"/><rect x="23" y="43" width="60" height="13" rx="6" fill="#d7b683"/>`;
  if (a.style === "cap") return `<path d="M25 49Q26 25 52 25Q77 25 78 49Z" fill="${a.hair}"/><path d="M25 47Q56 39 83 48Q70 59 22 54Z" fill="#153f55"/>`;
  return "";
}
function hair(a) {
  if (["beanie", "cap"].includes(a.style)) return "";
  if (a.style === "long") return `<path d="M25 58Q17 25 51 23Q85 22 80 58L87 93Q69 100 66 84L34 84Q27 100 18 90Z" fill="${a.hair}"/>`;
  if (a.style === "curly") return `<path d="M25 55Q16 36 28 30Q29 19 41 24Q50 15 59 23Q73 17 77 31Q90 35 79 55L70 46Q48 49 32 45Z" fill="${a.hair}"/><g fill="${a.hair}"><circle cx="30" cy="29" r="9"/><circle cx="45" cy="24" r="10"/><circle cx="62" cy="25" r="10"/><circle cx="75" cy="32" r="9"/></g>`;
  if (a.style === "swoop") return `<path d="M24 57Q17 32 34 25Q51 13 76 29Q85 39 79 55L74 44Q45 53 29 45Z" fill="${a.hair}"/><path d="M29 44Q41 20 71 30Q52 48 29 44Z" fill="${a.hair}"/>`;
  return `<path d="M25 54Q19 28 46 24Q74 19 79 44L76 55Q69 44 56 43Q40 49 29 45Z" fill="${a.hair}"/>`;
}
for (const a of avatars) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104" role="img" aria-label="Okey oyuncu avatarı">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/></linearGradient><clipPath id="clip"><circle cx="52" cy="52" r="52"/></clipPath></defs>
  <g clip-path="url(#clip)"><rect width="104" height="104" fill="url(#bg)"/>
  <circle cx="79" cy="19" r="22" fill="#fff" opacity=".13"/><circle cx="14" cy="92" r="30" fill="#fff" opacity=".09"/>
  <path d="M8 108Q11 84 34 80L52 87L70 80Q94 84 98 108Z" fill="${a.shirt}"/>
  <path d="M44 75h16v17Q52 99 44 91Z" fill="${a.skin}"/>
  ${hair(a)}
  <ellipse cx="52" cy="57" rx="25" ry="32" fill="${a.skin}"/>
  <path d="M29 48Q42 49 53 43Q64 49 75 44L75 38Q48 24 29 42Z" fill="${a.hair}"/>
  <ellipse cx="27" cy="61" rx="4" ry="7" fill="${a.skin}"/><ellipse cx="77" cy="61" rx="4" ry="7" fill="${a.skin}"/>
  <path d="M35 55h12M58 55h12" stroke="${a.hair}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="41" cy="61" r="2" fill="#292720"/><circle cx="64" cy="61" r="2" fill="#292720"/>
  <path d="M51 61l-2 10h5" fill="none" stroke="#9c5949" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M44 77Q52 82 61 76" fill="none" stroke="#853e3d" stroke-width="2" stroke-linecap="round"/>
  ${accessory(a)}
  <path d="M35 88Q52 97 69 88" fill="none" stroke="#fff" opacity=".22" stroke-width="2"/>
  </g></svg>`;
  writeFileSync(new URL(`../public/avatars/avatar-${a.id}.svg`, import.meta.url), svg);
}
