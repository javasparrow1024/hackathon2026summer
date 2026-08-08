const gameEl = document.querySelector(".game");
    const messageEl = document.querySelector("[data-message]");
    const enemyStatusEl = document.querySelector(".enemy-status");
    const enemyVisualEl = document.querySelector("[data-enemy-visual]");
    const enemyImageEl = document.querySelector("[data-enemy-image]");
    const restartButton = document.querySelector("[data-restart]");

    const enemyList = [
      { name: "スライム", level: 1, maxHp: 40, attackMin: 5, attackMax: 9, attackInterval: 2300, color: "#2c9be2", marker: "SLIME", image: "assets/enemies/slime.png", visualWidth: "35%", visualTop: "8%" },
      { name: "コボルト", level: 2, maxHp: 62, attackMin: 7, attackMax: 12, attackInterval: 2100, color: "#9f6a39", marker: "KOBOLD", image: "assets/enemies/kobold-kouho.png", visualWidth: "35%", visualTop: "5%" },
      { name: "ゴーレム", level: 3, maxHp: 92, attackMin: 10, attackMax: 16, attackInterval: 2500, color: "#747a7f", marker: "GOLEM", image: "assets/enemies/golem-kouho.png", visualWidth: "45%", visualTop: "3%" },
      { name: "ドラゴン", level: 4, maxHp: 135, attackMin: 14, attackMax: 22, attackInterval: 1900, color: "#b84b3d", marker: "DRAGON", image: "assets/enemies/dragon-kouho.png", visualWidth: "55%", visualTop: "-8%" }
    ];

    let currentEnemyIndex = 0;
    const enemy = { ...enemyList[currentEnemyIndex], hp: enemyList[currentEnemyIndex].maxHp };

    const heroes = [
      {
        id: "mage",
        name: "魔法使い",
        hp: 60,
        maxHp: 60,
        skills: [
          { label: "回復", word: "kaifuku", kind: "heal" },
          { label: "癒し", word: "iyashi", kind: "heal" },
          { label: "生命", word: "seimei", kind: "heal" },
          { label: "祝福", word: "shukufuku", kind: "heal" }
        ]
      },
      {
        id: "swordsman",
        name: "剣士",
        hp: 90,
        maxHp: 90,
        skills: [
          { label: "斬撃", word: "zangeki", kind: "attack" },
          { label: "切る", word: "kiru", kind: "attack" },
          { label: "紫電一閃", word: "shidennissen", kind: "attack" },
          { label: "早業", word: "hayawaza", kind: "attack" }
        ]
      },
      {
        id: "knight",
        name: "騎士",
        hp: 130,
        maxHp: 130,
        guard: 0,
        skills: [
          { label: "鉄壁", word: "teppeki", kind: "guard" },
          { label: "防御", word: "bougyo", kind: "guard" },
          { label: "挑発", word: "chouhatsu", kind: "guard" },
          { label: "守る", word: "mamoru", kind: "guard" },
          { label: "七転八倒", word: "shichitenhattou", kind: "guard" }
        ]
      }
    ];

    const cards = new Map();
    const members = new Map();
    let activeHero = null;
    let typed = "";
    let isBattleOver = false;
    let isChangingEnemy = false;
    let messageTimer = 0;
    let enemyTimer = 0;
    let enemyChangeTimer = 0;

    document.querySelectorAll("[data-card]").forEach((card) => {
      cards.set(card.dataset.card, {
        root: card,
        name: card.querySelector("[data-skill-name]"),
        word: card.querySelector("[data-typing-word]")
      });
    });

    document.querySelectorAll("[data-member]").forEach((member) => {
      members.set(member.dataset.member, {
        root: member,
        hpNumber: member.querySelector("[data-hp-number]"),
        hpBar: member.querySelector("[data-hp-bar]")
      });
    });

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function showMessage(text, keepVisible = false) {
      window.clearTimeout(messageTimer);
      messageEl.textContent = text;
      messageEl.classList.add("is-visible");
      if (keepVisible) return;
      messageTimer = window.setTimeout(() => {
        messageEl.classList.remove("is-visible");
      }, 1000);
    }

    function restartAnimation(element, className) {
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    }

    const romajiAlternates = [
      ["shi", ["shi", "si"]],
      ["chi", ["chi", "ti"]],
      ["tsu", ["tsu", "tu"]],
      ["fu", ["fu", "hu"]],
      ["ji", ["ji", "zi"]],
      ["sha", ["sha", "sya"]],
      ["shu", ["shu", "syu"]],
      ["sho", ["sho", "syo"]],
      ["cha", ["cha", "tya", "cya"]],
      ["chu", ["chu", "tyu", "cyu"]],
      ["cho", ["cho", "tyo", "cyo"]],
      ["ja", ["ja", "jya", "zya"]],
      ["ju", ["ju", "jyu", "zyu"]],
      ["jo", ["jo", "jyo", "zyo"]]
    ];

    function expandSmallTsuVariants(word) {
      const results = new Set([word]);
      word.replace(/([bcdfghjklmnpqrstvwxyz])\1/g, (match, consonant, index) => {
        Array.from(results).forEach((value) => {
          const before = value.slice(0, index);
          const after = value.slice(index + 1);
          results.add(`${before}xtu${after}`);
          results.add(`${before}ltu${after}`);
        });
        return match;
      });
      return Array.from(results);
    }

    function buildRomajiVariants(word) {
      let variants = expandSmallTsuVariants(word);
      romajiAlternates.forEach(([base, choices]) => {
        variants = variants.flatMap((variant) => {
          if (!variant.includes(base)) return [variant];
          return choices.map((choice) => variant.split(base).join(choice));
        });
      });
      return Array.from(new Set(variants)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    }

    function prepareSkill(skill) {
      skill.variants = buildRomajiVariants(skill.word);
      return skill;
    }

    heroes.forEach((hero) => {
      hero.skills.forEach(prepareSkill);
    });

    function possibleVariants(hero) {
      return hero.currentSkill.variants || [hero.currentSkill.word];
    }

    function variantFirstLetters(skill) {
      return new Set((skill.variants || [skill.word]).map((variant) => variant[0]));
    }

    function hasAnySharedFirstLetter(skill, usedFirstLetters) {
      return Array.from(variantFirstLetters(skill)).some((letter) => usedFirstLetters.has(letter));
    }

    function typedMatches(hero, value) {
      return possibleVariants(hero).some((variant) => variant.startsWith(value));
    }

    function typedCompleted(hero, value) {
      return possibleVariants(hero).includes(value);
    }

    function pickSkill(hero) {
      const usedFirstLetters = new Set(
        heroes
          .filter((other) => other.id !== hero.id && other.currentSkill)
          .flatMap((other) => Array.from(variantFirstLetters(other.currentSkill)))
      );
      const candidates = hero.skills.filter((skill) => !hasAnySharedFirstLetter(skill, usedFirstLetters));
      const pool = candidates.length ? candidates : hero.skills;
      const nextPool = pool.filter((skill) => !hero.currentSkill || skill.word !== hero.currentSkill.word);
      const finalPool = nextPool.length ? nextPool : pool;
      hero.currentSkill = finalPool[randomInt(0, finalPool.length - 1)];
    }

    function renderTypingWord(hero) {
      const card = cards.get(hero.id);
      const word = hero.currentSkill.word;
      const isActive = activeHero && activeHero.id === hero.id;
      const isDead = hero.hp <= 0;

      card.name.textContent = hero.currentSkill.label;
      card.root.classList.toggle("is-active", isActive && !isDead);
      card.root.classList.toggle("is-dead", isDead);

      if (!isActive) {
        card.word.innerHTML = `<b>${word[0]}</b>${word.slice(1)}`;
        return;
      }

      const done = word.slice(0, typed.length);
      const next = word[typed.length] || "";
      const rest = word.slice(typed.length + 1);
      card.word.innerHTML =
        `<span class="typed">${done}</span>` +
        (next ? `<span class="next">${next}</span>` : "") +
        rest;
    }

    function renderHp() {
      document.querySelector("[data-enemy-name]").textContent = `${enemy.name} Lv.${enemy.level}`;
      document.querySelector("[data-enemy-hp]").textContent = `${enemy.hp} / ${enemy.maxHp}`;
      document.querySelector("[data-enemy-bar]").style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
      document.querySelector("[data-enemy-bar]").parentElement.setAttribute(
        "aria-label",
        `${enemy.name}のHP ${enemy.hp}/${enemy.maxHp}`
      );

      heroes.forEach((hero) => {
        const member = members.get(hero.id);
        const hpRatio = hero.hp / hero.maxHp;
        const hpPanel = member.root.querySelector(".party-hp");
        member.hpNumber.textContent = `${hero.hp} / ${hero.maxHp}`;
        member.hpBar.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
        member.root.setAttribute("aria-label", `${hero.name} HP ${hero.hp}/${hero.maxHp}`);
        hpPanel.classList.toggle("is-caution", hero.hp > 0 && hpRatio < .5 && hpRatio >= .3);
        hpPanel.classList.toggle("is-danger", hero.hp > 0 && hpRatio < .3);
        hpPanel.classList.toggle("is-dead", hero.hp <= 0);
        member.root.classList.toggle("is-dead", hero.hp <= 0);
      });
    }

    function renderEnemyVisual() {
      enemyImageEl.src = enemy.image;
      enemyImageEl.alt = enemy.name;
      enemyVisualEl.style.setProperty("--enemy-visual-width", enemy.visualWidth || "20%");
      enemyVisualEl.style.setProperty("--enemy-visual-top", enemy.visualTop || "26%");
    }

    function renderSkills() {
      heroes.forEach(renderTypingWord);
    }

    function livingHeroes() {
      return heroes.filter((hero) => hero.hp > 0);
    }

    function lowestWoundedHero() {
      return heroes
        .filter((hero) => hero.hp > 0 && hero.hp < hero.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
    }

    function startEnemyTimer() {
      window.clearInterval(enemyTimer);
      enemyTimer = window.setInterval(enemyAttack, enemy.attackInterval);
    }

    function loadEnemy(index) {
      const nextEnemy = enemyList[index];
      Object.assign(enemy, nextEnemy, { hp: nextEnemy.maxHp });
      heroes.forEach((hero) => {
        if (hero.id === "knight") hero.guard = 0;
      });
      activeHero = null;
      typed = "";
      isChangingEnemy = false;
      renderHp();
      renderEnemyVisual();
      renderSkills();
      showMessage(`${enemy.name}が現れた！`);
      startEnemyTimer();
    }

    function defeatEnemy() {
      window.clearInterval(enemyTimer);
      renderHp();
      restartAnimation(enemyStatusEl, "is-hit");
      restartAnimation(enemyVisualEl, "is-hit");

      if (currentEnemyIndex >= enemyList.length - 1) {
        endBattle("ドラゴンを倒した！ 勝利！");
        return;
      }

      isChangingEnemy = true;
      activeHero = null;
      typed = "";
      renderSkills();
      showMessage(`${enemy.name}を倒した！`);

      enemyChangeTimer = window.setTimeout(() => {
        enemyChangeTimer = 0;
        if (isBattleOver || !livingHeroes().length) return;
        currentEnemyIndex += 1;
        loadEnemy(currentEnemyIndex);
      }, 1100);
    }

    function useSkill(hero) {
      const skill = hero.currentSkill;
      const lengthBonus = skill.word.length;

      restartAnimation(cards.get(hero.id).root, "is-cast");

      if (skill.kind === "attack") {
        const damage = 6 + lengthBonus;
        enemy.hp = clamp(enemy.hp - damage, 0, enemy.maxHp);
        restartAnimation(enemyStatusEl, "is-hit");
        restartAnimation(enemyVisualEl, "is-hit");
        restartAnimation(gameEl, "effect-slash");
        showMessage(`${skill.label}！ ${damage}ダメージ`);
      }

      if (skill.kind === "heal") {
        const target = lowestWoundedHero() || hero;
        const amount = 8 + Math.ceil(lengthBonus / 2);
        target.hp = clamp(target.hp + amount, 0, target.maxHp);
        restartAnimation(gameEl, "effect-heal");
        showMessage(`${skill.label}！ ${target.name}が${amount}回復`);
      }

      if (skill.kind === "guard") {
        hero.guard = 2;
        restartAnimation(gameEl, "effect-guard");
        showMessage(`${skill.label}！ 攻撃を引き受ける`);
      }

      if (enemy.hp <= 0) {
        defeatEnemy();
        return;
      }

      pickSkill(hero);
      activeHero = null;
      typed = "";
      renderHp();
      renderSkills();
    }

    function chooseEnemyTarget() {
      const knight = heroes.find((hero) => hero.id === "knight");
      if (knight && knight.hp > 0 && knight.guard > 0) {
        knight.guard -= 1;
        return { target: knight, guarded: true };
      }
      const targets = livingHeroes();
      if (!targets.length) return { target: null, guarded: false };

      const swordsman = heroes.find((hero) => hero.id === "swordsman");
      const otherLivingHeroes = targets.filter((hero) => hero.id !== "swordsman");
      const swordsmanCouldFallInOneHit =
        swordsman && swordsman.hp <= enemy.attackMax;

      // Keep the swordsman available for attacks while another ally can take the hit.
      if (swordsmanCouldFallInOneHit && otherLivingHeroes.length) {
        return {
          target: otherLivingHeroes[randomInt(0, otherLivingHeroes.length - 1)],
          guarded: false
        };
      }

      return { target: targets[randomInt(0, targets.length - 1)], guarded: false };
    }

    function enemyAttack() {
      if (isBattleOver || enemy.hp <= 0) return;

      const attack = chooseEnemyTarget();
      const target = attack.target;
      if (!target) {
        endBattle("全滅した...");
        return;
      }

      const baseDamage = randomInt(enemy.attackMin, enemy.attackMax);
      const damage = attack.guarded ? Math.floor(baseDamage * .75) : baseDamage;
      target.hp = clamp(target.hp - damage, 0, target.maxHp);
      restartAnimation(members.get(target.id).root, "is-hit");
      showMessage(`${enemy.name}の攻撃！ ${target.name}に${damage}ダメージ`);

      if (activeHero && activeHero.hp <= 0) {
        activeHero = null;
        typed = "";
        renderSkills();
      }

      if (!livingHeroes().length) {
        endBattle("全滅した...");
        return;
      }

      renderHp();
      renderSkills();
    }

    function endBattle(text) {
      isBattleOver = true;
      window.clearInterval(enemyTimer);
      activeHero = null;
      typed = "";
      renderHp();
      renderSkills();
      showMessage(text, true);
    }

    function resetActiveInput() {
      if (!activeHero) return;
      activeHero = null;
      typed = "";
      renderSkills();
    }

    function handleTyping(key) {
      if (isBattleOver || isChangingEnemy || !/^[a-z]$/.test(key)) return;

      if (!activeHero) {
        activeHero = heroes.find((hero) =>
          hero.hp > 0 && possibleVariants(hero).some((variant) => variant[0] === key)
        );
        if (!activeHero) return;
        typed = key;
        renderSkills();
      } else {
        const nextTyped = typed + key;
        if (!typedMatches(activeHero, nextTyped)) {
          restartAnimation(cards.get(activeHero.id).root, "is-error");
          resetActiveInput();
          return;
        }
        typed = nextTyped;
        renderSkills();
      }

      if (typedCompleted(activeHero, typed)) {
        useSkill(activeHero);
      }
    }

    function startBattle() {
      heroes.forEach(pickSkill);
      loadEnemy(currentEnemyIndex);
      renderHp();
      renderSkills();
    }

    function restartBattle() {
      window.clearInterval(enemyTimer);
      window.clearTimeout(enemyChangeTimer);
      window.clearTimeout(messageTimer);
      currentEnemyIndex = 0;
      isBattleOver = false;
      isChangingEnemy = false;
      activeHero = null;
      typed = "";
      messageEl.classList.remove("is-visible");

      heroes.forEach((hero) => {
        hero.hp = hero.maxHp;
        hero.guard = 0;
        hero.currentSkill = null;
      });

      heroes.forEach(pickSkill);
      loadEnemy(currentEnemyIndex);
    }

    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        resetActiveInput();
        return;
      }
      handleTyping(key);
    });

    restartButton.addEventListener("click", restartBattle);

    startBattle();
