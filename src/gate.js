(() => {
  const config = window.REPORT_PORTAL_AUTH || {};
  if (!config.enabled || !config.passwordHash) return;

  const storageKey = `entropy-report-hub-auth:${config.passwordHash.slice(0, 12)}`;

  const unlock = () => {
    document.documentElement.classList.remove("auth-locked");
    document.querySelector("[data-auth-gate]")?.remove();
  };

  const lock = () => {
    document.documentElement.classList.add("auth-locked");
  };

  const hashText = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const buildGate = () => {
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.dataset.authGate = "true";
    gate.innerHTML = `
      <form class="auth-panel" data-auth-form>
        <img class="auth-logo" src="${config.assetBase || "./assets/"}entropy-logo-bk.png" alt="Entropy Makeup" />
        <h1>보고서 열기</h1>
        <p>비밀번호를 입력하면 보고서 목록을 확인할 수 있습니다.</p>
        <label>
          <span>비밀번호</span>
          <input name="password" type="password" autocomplete="current-password" required autofocus />
        </label>
        <button type="submit">열기</button>
        <output class="auth-error" data-auth-error></output>
      </form>
    `;
    document.body.appendChild(gate);

    const form = gate.querySelector("[data-auth-form]");
    const error = gate.querySelector("[data-auth-error]");
    const input = gate.querySelector("input");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const submittedHash = await hashText(input.value);
      if (submittedHash === config.passwordHash) {
        sessionStorage.setItem(storageKey, "unlocked");
        unlock();
        return;
      }
      input.value = "";
      input.focus();
      error.textContent = "비밀번호가 맞지 않습니다.";
    });
  };

  lock();

  if (sessionStorage.getItem(storageKey) === "unlocked") {
    unlock();
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildGate, { once: true });
  } else {
    buildGate();
  }
})();
