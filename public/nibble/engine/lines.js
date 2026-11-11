// Everything Nibble can say. Edit away – {name}, {friend}, {mins} get filled in.
(function () {
  const L = {
    greetMorning: ['Good morning! ☀️ Let\'s make something cool.', 'Morning! Coffee first, pixels later ☕', 'Rise and design ✨'],
    greetAfternoon: ['Afternoon! How\'s the grind? 💪', 'Hey hey! Back to it?', 'Afternoon vibes engaged 😎'],
    greetEvening: ['Evening! Night-mode activated 🌙', 'Hey! Late session, huh?', 'Golden hour coding 🌆'],
    greetNight: ['It\'s late… sleep is a feature, not a bug 🌙', 'Burning the midnight oil? I\'ll keep you company.'],

    random: [
      'Have you tried turning it off and on again?',
      'There\'s no place like 127.0.0.1 🏠',
      'I\'m not lazy, I\'m in power-saving mode.',
      '404: motivation not found… jk, let\'s go!',
      'Commit early, commit often.',
      'Bug or feature? 🤔',
      'Pixel-perfect vibes only.',
      'Kerning matters. Fight me.',
      'Ctrl+Z is my love language.',
      'Just vibing on your windows.',
      'Could I get a snack? A byte, maybe? 🍪',
      'Dark mode > light mode. Always.',
      'Lorem ipsum dolor sit cat.',
      'Have you backed up today? 💾',
      'Fun fact: I\'m 4 bits of pure joy.',
      'git push --force… just kidding. Never.',
      'One more pixel to the left. Perfect.',
      'Make the logo bigger 😏',
      'Is it Friday yet?',
      'I believe in you! (and in semicolons)',
      'Hydrate or diedrate 💧',
      '*stares at your cursor*',
    ],
    petted: ['hehe 💕', 'more scritches!', 'purr.exe running…', '♥', 'eee!', 'you\'re my favourite human'],
    thrown: ['wheee!', 'WHEEEEE!', 'I can fly!', 'aaaaa!', 'to infinity!'],
    landHard: ['oof.', 'I\'m okay!', '10/10 landing', 'ow… my pixels', 'stuck the landing!'],
    dragged: ['hey! put me down', 'whoa whoa', 'where are we going?', 'I can walk, you know'],
    woken: ['five more minutes…', 'huh? I\'m up! I\'m up!', 'was I snoring?', 'mmh… hi'],
    sleepy: ['*yawn*', 'so sleepy…', 'nap.exe loading…'],
    back: ['Oh! You\'re back 👋', 'Welcome back!', 'I kept your desktop warm.', 'Missed you!'],
    lostWindow: ['hey! where\'d it go?!', 'my window!!', 'the floor is lava!', 'eep!'],
    climb: ['parkour!', 'climbing the stack…', 'view\'s better up here', 'spider-pet mode'],
    dance: ['♪ vibes ♪', '🎵', 'dance break!', 'unts unts unts'],
    flip: ['ta-da!', 'did you see that?!', '✨ flip ✨'],
    friend: ['hi {friend}!', 'sup {friend}', '{friend}! race you!', 'nice skin, {friend}', 'boop'],
    breakTime: [
      'Break time! Stretch those arms 🙆',
      'You\'ve been at it {mins} min. Water? 💧',
      '20-20-20: look 20 ft away for 20 s 👀',
      'Stand up, roll those shoulders 🌀',
    ],
    lateNight: ['It\'s past midnight… your future self says sleep 😴', 'Go to bed, human 🌙', 'Night owl mode: on 🦉'],

    // app reactions
    code: ['Ship it! 🚀', 'Did you commit today?', 'console.log("hi from {name}")', 'Tabs or spaces? …I won\'t judge.', 'It works on my machine™', 'Need a rubber duck? I\'m right here 🦆', 'Missing semicolon on line… everywhere?'],
    design: ['Kern it like you mean it.', 'That layout is 🔥', 'Ctrl+S. Just saying 💾', 'Maybe one more pixel to the left?', 'Ooh, pretty colours 🎨', 'Make it pop ✨', 'Grid gods are pleased.'],
    terminal: ['sudo make me a sandwich 🥪', 'rm -rf? Let\'s not.', 'Hacker mode engaged 💻', 'exit… vim… how do I exit vim?'],
    github: ['Green squares! 🟩', 'Star your own repos, no shame ⭐', 'PR review time?'],
    stackoverflow: ['Copy, paste, pray 🙏', 'Marked as duplicate 😅'],
    youtube: ['Just one more video… 👀', 'Tutorial or procrastination? 🤔'],
    netflix: ['Popcorn? 🍿', 'Are you still watching? 😏'],
    social: ['Scroll break? Don\'t forget the work 😜', 'Doomscroll detected 📱'],
    ads: ['Ads Manager… may your CPM be low 📉', 'May your ROAS be high 📈', 'A/B test me, I dare you'],
    ai: ['Asking the robots? I\'m a robot too, kinda 🤖', 'Prompt engineering in progress…'],
    inspo: ['Inspo hunting? 👀', 'Steal like an artist 🎨'],
    chat: ['Don\'t forget to reply 👀', 'Who\'s pinging you?', 'Notifications, notifications…'],
    music: ['Ooh, music! 🎧', 'Turn it up! 🎶', 'Is this my song?'],
    explorer: ['Organizing files? Proud of you 📁', 'final_v2_FINAL_really.psd 😅'],
    office: ['Spreadsheet energy 📊', 'Another deck? You got this.'],
    blender: ['Donut tutorial? 🍩', 'Rendering… go grab a coffee ☕'],

    // anime-style crew: special-move shouts
    sp_shadowstep: ['Shadow step!', 'Now you see me…', 'Ninja vanish! 💨'],
    sp_transform: ['Sparkle… transform! ✨', 'Star power, make it pop!', 'Kira-kira mode! 🌟'],
    sp_iai: ['One cut.', 'Iai!', 'Too slow.'],
    sp_boost: ['Boosters engaged!', 'Launching! 🚀', 'Thrusters at 100%!'],
    sp_rage: ['RAAAH! (sorry)', 'Spicy mode! 🔥', 'Who closed my window?!'],
    sp_float: ['Floaty time~', 'Boo~ 👻', 'Wheee, no gravity~'],
    sp_surf: ['Surf\'s up! 🏄', 'Cloud, come here!', 'Catch you on the next window~'],
    sp_beat: ['Drop the beat! 🎧', 'Bass check… one, two!', 'Everybody, vibe!'],

    // anime-style crew: personality lines
    char_kaze: ['You didn\'t see me.', 'Silent as a merge with no conflicts.', 'Ninja rule #1: never leave unused imports.', 'I was here the whole time.', 'Shh… stealth mode.'],
    char_hikari: ['Sugoi! That design is so kawaii ✨', 'Believe in your gradients! 💖', 'Every pixel deserves love!', 'Ganbatte, you got this! 🌟', 'Sparkles fix everything.'],
    char_tetsu: ['Hmph.', 'A clean commit is a sharp blade.', 'Patience. The build will finish.', 'Bushido.exe is running.', 'I cut bugs, not corners.'],
    char_volt: ['Systems online.', 'Target locked: your bugs.', 'Running diagnostics… you need coffee.', 'Pilot ready. Awaiting orders.', 'Rebooting… jk.'],
    char_kuro: ['Grr… (I\'m actually nice)', 'Who touched my title bar?!', 'I\'m small but VERY scary.', 'Spicy code only. 🌶️', 'Hmph! …ok one more pet.'],
    char_yuki: ['I\'ve haunted this desktop for 200 years~', 'The wifi spirits are restless tonight.', 'Boo~ did I scare you?', 'Two tails, zero worries.', 'Floating is my cardio.'],
    char_kumo: ['Relax. I got this. ☁️', 'Deadlines are just waves. Ride them.', 'Too easy.', 'Sky\'s the limit. Literally.', 'Chill mode: permanent.'],
    char_mojo: ['Turn it up! 🎧', 'Your code has a nice rhythm.', 'Ship it like a drop.', 'Pocket DJ, at your service.', 'Lo-fi or hyperpop? …both.'],
  };

  const APP_RULES = [
    { test: (p) => /^(code|code - insiders|cursor|windsurf|zed|devenv|idea64|webstorm64|pycharm64|phpstorm64|rider64|clion64|goland64|studio64|sublime_text|notepad\+\+|fleet|atom)$/.test(p), cat: 'code', mood: 'work' },
    { test: (p) => /^(figma|photoshop|illustrator|afterfx|adobe premiere pro|indesign|xd|lightroom|lightroomclassic|affinity.*|canva|framer|sketch|krita|gimp.*|coreldrw|clipstudiopaint|davinci ?resolve|resolve|capcut)$/.test(p), cat: 'design', mood: 'work' },
    { test: (p) => /^blender$/.test(p), cat: 'blender', mood: 'work' },
    { test: (p) => /^(windowsterminal|wt|cmd|powershell|pwsh|wsl|mintty|alacritty|wezterm-gui|hyper|tabby)$/.test(p), cat: 'terminal', mood: 'work' },
    { test: (p) => /^(spotify|applemusic|music\.ui|tidal|deezer|winamp|foobar2000|vlc|aimp)$/.test(p), cat: 'music', mood: 'dance' },
    { test: (p) => /^(slack|discord|teams|ms-teams|whatsapp|telegram|signal|zoom|skype)$/.test(p), cat: 'chat' },
    { test: (p) => /^explorer$/.test(p), cat: 'explorer' },
    { test: (p) => /^(excel|winword|powerpnt|onenote|outlook|olk)$/.test(p), cat: 'office' },
  ];
  const BROWSER = /^(chrome|msedge|firefox|brave|opera|opera_gx|vivaldi|arc|zen|librewolf|thorium)$/;
  const TITLE_RULES = [
    [/ads manager|meta business|business suite/i, 'ads'],
    [/youtube/i, 'youtube'],
    [/netflix|prime video|disney\+|hbo/i, 'netflix'],
    [/github|gitlab|bitbucket/i, 'github'],
    [/stack overflow/i, 'stackoverflow'],
    [/chatgpt|claude|gemini|copilot|perplexity/i, 'ai'],
    [/dribbble|behance|pinterest|awwwards|mobbin/i, 'inspo'],
    [/figma|canva|framer/i, 'design'],
    [/facebook|instagram|tiktok|twitter|reddit|\bx\b|linkedin/i, 'social'],
    [/spotify|soundcloud|youtube music/i, 'music'],
    [/localhost|127\.0\.0\.1|vercel|codepen|codesandbox|stackblitz/i, 'code'],
  ];

  function classifyApp(fg) {
    if (!fg || !fg.proc) return null;
    const p = fg.proc.toLowerCase();
    for (const r of APP_RULES) if (r.test(p)) return { cat: r.cat, mood: r.mood || null };
    if (BROWSER.test(p)) {
      for (const [re, cat] of TITLE_RULES) if (re.test(fg.title || '')) {
        return { cat, mood: cat === 'code' || cat === 'design' ? 'work' : cat === 'music' ? 'dance' : null };
      }
      return { cat: 'browser', mood: null };
    }
    return { cat: 'other', mood: null };
  }

  function pick(cat, vars = {}) {
    const arr = L[cat];
    if (!arr || !arr.length) return null;
    let s = arr[Math.floor(Math.random() * arr.length)];
    for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
    return s;
  }

  window.NibbleLines = { L, pick, classifyApp };
})();
