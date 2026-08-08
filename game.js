const gameEl = document.querySelector(".game");
    const messageEl = document.querySelector("[data-message]");
    const enemyStatusEl = document.querySelector(".enemy-status");
    const enemyVisualEl = document.querySelector("[data-enemy-visual]");
    const enemyImageEl = document.querySelector("[data-enemy-image]");
    const levelSelectButton = document.querySelector("[data-level-select]");
    const screens = new Map(
      Array.from(document.querySelectorAll("[data-screen]")).map((screen) => [screen.dataset.screen, screen])
    );
    const resultTitleEl = document.querySelector("[data-result-title]");
    const resultPrimaryButton = document.querySelector("[data-result-primary]");
    const resultSelectButton = document.querySelector("[data-result-select]");

    const enemyList = [
      { name: "スライム", level: 1, maxHp: 40, attackMin: 5, attackMax: 9, attackInterval: 2300, color: "#2c9be2", marker: "SLIME", image: "assets/enemies/slime.png", visualWidth: "35%", visualTop: "8%" },
      { name: "コボルト", level: 2, maxHp: 62, attackMin: 7, attackMax: 12, attackInterval: 2100, color: "#9f6a39", marker: "KOBOLD", image: "assets/enemies/kobold-kouho.png", visualWidth: "35%", visualTop: "5%" },
      { name: "ゴーレム", level: 3, maxHp: 92, attackMin: 10, attackMax: 16, attackInterval: 2500, color: "#747a7f", marker: "GOLEM", image: "assets/enemies/golem-kouho.png", visualWidth: "45%", visualTop: "3%" },
      { name: "ドラゴン", level: 4, maxHp: 135, attackMin: 14, attackMax: 22, attackInterval: 1900, color: "#b84b3d", marker: "DRAGON", image: "assets/enemies/dragon-kouho.png", visualWidth: "55%", visualTop: "-8%" }
    ];

    const difficultyConfigs = {
      1: { hpMultiplier: .7, attackMultiplier: .7, intervalMultiplier: 1.2 },
      2: { hpMultiplier: 1, attackMultiplier: 1, intervalMultiplier: 1 },
      3: { hpMultiplier: 1.35, attackMultiplier: 1.35, intervalMultiplier: .85 }
    };

    let currentEnemyIndex = 0;
    let currentLevel = 1;
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
    let resultTimer = 0;
    let gamePhase = "title";

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

    const romajiAlternateGroups = [
      ["shi", "si"],
      ["chi", "ti", "ci"],
      ["tsu", "tu"],
      ["fu", "hu"],
      ["ji", "zi"],
      ["sha", "sya"],
      ["shu", "syu"],
      ["sho", "syo"],
      ["cha", "tya", "cya"],
      ["chu", "tyu", "cyu"],
      ["cho", "tyo", "cyo"],
      ["ja", "jya", "zya"],
      ["ju", "jyu", "zyu"],
      ["jo", "jyo", "zyo"]
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

    function normalizeTerminalN(word) {
      return word.endsWith("n") && !word.endsWith("nn") ? `${word}n` : word;
    }

    function expandNVariants(word) {
      let variants = new Set([""]);

      for (let index = 0; index < word.length; index += 1) {
        const character = word[index];
        const nextCharacter = word[index + 1] || "";
        const canDoubleN =
          character === "n" &&
          nextCharacter &&
          nextCharacter !== "n" &&
          !/[aeiouy]/.test(nextCharacter);
        const nextVariants = new Set();

        variants.forEach((prefix) => {
          nextVariants.add(`${prefix}${character}`);
          if (canDoubleN) nextVariants.add(`${prefix}nn`);
        });

        variants = nextVariants;
      }

      return Array.from(variants);
    }

    function buildRomajiVariants(word) {
      let variants = expandSmallTsuVariants(word);
      romajiAlternateGroups.forEach((group) => {
        variants = variants.flatMap((variant) => {
          const matchedSpelling = group.find((spelling) => variant.includes(spelling));
          if (!matchedSpelling) return [variant];
          return group.map((choice) => variant.split(matchedSpelling).join(choice));
        });
      });
      variants = variants.flatMap(expandNVariants);
      return Array.from(new Set(variants)).sort((a, b) => a.length - b.length || a.localeCompare(b));
    }

    function prepareSkill(skill) {
      skill.guideWord = normalizeTerminalN(skill.word);
      skill.variants = buildRomajiVariants(skill.guideWord);
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

    function guideWordFor(hero) {
      const defaultWord = hero.currentSkill.guideWord || hero.currentSkill.word;
      if (defaultWord.startsWith(typed)) return defaultWord;
      return possibleVariants(hero).find((variant) => variant.startsWith(typed)) || defaultWord;
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
      const isActive = activeHero && activeHero.id === hero.id;
      const isDead = hero.hp <= 0;
      const word = isActive ? guideWordFor(hero) : (hero.currentSkill.guideWord || hero.currentSkill.word);

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
      document.querySelector("[data-enemy-name]").textContent = `${enemy.name} Lv.${currentLevel}`;
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

    function buildEnemy(baseEnemy) {
      const config = difficultyConfigs[currentLevel];
      return {
        ...baseEnemy,
        maxHp: Math.max(1, Math.round(baseEnemy.maxHp * config.hpMultiplier)),
        attackMin: Math.max(1, Math.round(baseEnemy.attackMin * config.attackMultiplier)),
        attackMax: Math.max(1, Math.round(baseEnemy.attackMax * config.attackMultiplier)),
        attackInterval: Math.max(500, Math.round(baseEnemy.attackInterval * config.intervalMultiplier))
      };
    }

    function startEnemyTimer() {
      window.clearInterval(enemyTimer);
      enemyTimer = window.setInterval(enemyAttack, enemy.attackInterval);
    }

    function loadEnemy(index) {
      const nextEnemy = buildEnemy(enemyList[index]);
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
        showResultAfterDelay("victory", `${enemy.name}を倒した！`);
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
        endBattle();
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
        endBattle(target);
        return;
      }

      renderHp();
      renderSkills();
    }

    function endBattle(lastHero) {
      isBattleOver = true;
      window.clearInterval(enemyTimer);
      activeHero = null;
      typed = "";
      renderHp();
      renderSkills();
      showResultAfterDelay("defeat", `${lastHero ? lastHero.name : "仲間"}が倒れた...`);
    }

    function resetActiveInput() {
      if (!activeHero) return;
      activeHero = null;
      typed = "";
      renderSkills();
    }

    function handleTyping(key) {
      if (gamePhase !== "battle" || isBattleOver || isChangingEnemy || !/^[a-z]$/.test(key)) return;

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

    function resetBattle() {
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

    }

    function showScreen(name) {
      screens.forEach((screen, screenName) => {
        screen.classList.toggle("is-visible", screenName === name);
      });
      gameEl.classList.toggle("is-screen-open", Boolean(name));
    }

    function showTitle() {
      window.clearInterval(enemyTimer);
      window.clearTimeout(enemyChangeTimer);
      gamePhase = "title";
      showScreen("title");
    }

    function showLevelSelect() {
      window.clearInterval(enemyTimer);
      window.clearTimeout(enemyChangeTimer);
      window.clearTimeout(messageTimer);
      window.clearTimeout(resultTimer);
      messageEl.classList.remove("is-visible");
      activeHero = null;
      typed = "";
      isBattleOver = true;
      isChangingEnemy = false;
      gamePhase = "level-select";
      showScreen("level-select");
    }

    function showResultAfterDelay(result, message) {
      window.clearInterval(enemyTimer);
      window.clearTimeout(enemyChangeTimer);
      window.clearTimeout(messageTimer);
      window.clearTimeout(resultTimer);
      activeHero = null;
      typed = "";
      isBattleOver = true;
      isChangingEnemy = false;
      gamePhase = "result-transition";
      showMessage(message, true);

      resultTimer = window.setTimeout(() => {
        resultTimer = 0;
        showResult(result);
      }, 2000);
    }

    function showResult(result) {
      window.clearInterval(enemyTimer);
      window.clearTimeout(enemyChangeTimer);
      window.clearTimeout(messageTimer);
      window.clearTimeout(resultTimer);
      messageEl.classList.remove("is-visible");
      activeHero = null;
      typed = "";
      isBattleOver = true;
      isChangingEnemy = false;
      gamePhase = "result";

      if (result === "victory") {
        resultTitleEl.textContent = "勝利！";
        if (currentLevel < 3) {
          resultPrimaryButton.textContent = "次のレベルへ";
          resultPrimaryButton.dataset.resultAction = "next";
        } else {
          resultPrimaryButton.textContent = "もう一度";
          resultPrimaryButton.dataset.resultAction = "retry";
        }
      } else {
        resultTitleEl.textContent = "全滅...";
        resultPrimaryButton.textContent = "もう一度";
        resultPrimaryButton.dataset.resultAction = "retry";
      }

      showScreen("result");
    }

    function startRun(level) {
      currentLevel = level;
      currentEnemyIndex = 0;
      resetBattle();
      gamePhase = "battle";
      showScreen(null);
      startBattle();
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

    document.querySelector("[data-title-start]").addEventListener("click", showLevelSelect);
    document.querySelectorAll("[data-level]").forEach((button) => {
      button.addEventListener("click", () => startRun(Number(button.dataset.level)));
    });
    levelSelectButton.addEventListener("click", showLevelSelect);
    resultSelectButton.addEventListener("click", showLevelSelect);
    resultPrimaryButton.addEventListener("click", () => {
      const nextLevel = resultPrimaryButton.dataset.resultAction === "next" ? currentLevel + 1 : currentLevel;
      startRun(nextLevel);
    });

    showTitle();
