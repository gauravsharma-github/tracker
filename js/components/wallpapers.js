// Flip-clock wallpapers, drawn with CSS gradients (no image files to ship or license).
(function (TI) {
  const stars = 'radial-gradient(1.2px 1.2px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 72% 12%, #fff 50%, transparent 51%), radial-gradient(1.4px 1.4px at 38% 42%, #ffffffcc 50%, transparent 51%), radial-gradient(1px 1px at 86% 36%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 55% 22%, #ffffffaa 50%, transparent 51%), radial-gradient(1px 1px at 20% 64%, #ffffff99 50%, transparent 51%), radial-gradient(1.3px 1.3px at 64% 58%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 92% 70%, #ffffffbb 50%, transparent 51%), radial-gradient(1px 1px at 5% 85%, #ffffff88 50%, transparent 51%)';
  TI.wallpapers = [
    { id: 'meadow', label: 'Meadow', css: 'radial-gradient(120% 70% at 70% 8%, #f4e7c9 0%, rgba(244,231,201,0) 55%), linear-gradient(180deg, #6f8fa8 0%, #a9b9bf 38%, #cdb88f 58%, #8a6a45 72%, #4d3826 100%)' },
    { id: 'dusk', label: 'Dusk', css: 'radial-gradient(90% 60% at 50% 100%, #ffb36b 0%, rgba(255,179,107,0) 60%), linear-gradient(180deg, #1d1a3a 0%, #4b2c5e 45%, #c4566a 75%, #f39a5b 100%)' },
    { id: 'ocean', label: 'Ocean', css: 'radial-gradient(80% 50% at 50% 0%, #d7f3f7 0%, rgba(215,243,247,0) 70%), linear-gradient(180deg, #7cc6d8 0%, #2b8fb0 45%, #0f5677 70%, #072b40 100%)' },
    { id: 'forest', label: 'Forest', css: 'radial-gradient(70% 45% at 30% 0%, #e3efc9 0%, rgba(227,239,201,0) 70%), repeating-linear-gradient(95deg, rgba(10,25,15,.0) 0 38px, rgba(10,25,15,.35) 38px 46px), linear-gradient(180deg, #9cbf8a 0%, #4f7d4f 40%, #24432b 75%, #0e1f14 100%)', pro: true },
    { id: 'night', label: 'Night sky', css: `${stars}, radial-gradient(60% 40% at 80% 10%, #33407a 0%, rgba(51,64,122,0) 70%), linear-gradient(180deg, #0a0f2a 0%, #070a1a 60%, #03050d 100%)`, pro: true },
    { id: 'aurora', label: 'Aurora', css: 'radial-gradient(60% 35% at 30% 30%, rgba(60,220,160,.55) 0%, rgba(60,220,160,0) 70%), radial-gradient(50% 30% at 70% 22%, rgba(150,90,255,.5) 0%, rgba(150,90,255,0) 70%), linear-gradient(180deg, #04121f 0%, #082236 55%, #02070d 100%)', pro: true },
    { id: 'paper', label: 'Paper', css: 'radial-gradient(100% 80% at 50% 0%, #f7f1e3 0%, #e6dcc6 100%)', pro: true },
    { id: 'mono', label: 'Black', css: '#000' },
  ];
  TI.wallpaper = (id) => TI.wallpapers.find((w) => w.id === id) || TI.wallpapers[0];
})(window.TI);
