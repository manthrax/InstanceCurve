document.body.insertAdjacentHTML(
  "beforeend",
  `
<div id="errorPopup" style="display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.9);opacity:0;transition:transform .4s ease-out, opacity .4s ease-out;padding:20px;background:#f0f0f0;border:1px solid #333;box-shadow:0 4px 8px rgba(0,0,0,.5);border-radius:8px;max-width:600px;width:80%;z-index:1000;overflow:auto;font-family:'Roboto', sans-serif;line-height:1.6;">
    <button onclick="document.getElementById('errorPopup').style.opacity='0';setTimeout(() => document.getElementById('errorPopup').style.display='none', 400);">Close</button>
    <p></p><pre class="codeSnippet" style="white-space:pre-wrap;word-wrap:break-word;background:#eee;padding:10px;margin-top:15px;border-left:3px solid #cc0000;"></pre>
</div>`
);

window.onerror = async (m, u, l, c, e) => {
  const msg = document.querySelector("#errorPopup > p");
  const codeSnippet = document.querySelector("#errorPopup .codeSnippet");
  msg.innerHTML = `Error Occurred:<br><strong>Message:</strong> ${m}<br><strong>URL:</strong> <a href="${u}" target="_blank">${u}</a><br><strong>Line:</strong> ${l}, <strong>Column:</strong> ${c}<br><strong>Error:</strong> ${
    e ? e.stack : "No stack available"
  }`;

  try {
    const response = await fetch(u);
    const text = await response.text();
    const lines = text.split("\n");
    const errorContext = lines
      .slice(Math.max(l - 3, 0), Math.min(l + 2, lines.length))
      .join("\n");
    codeSnippet.textContent = `...${errorContext}...`;
  } catch (err) {
    codeSnippet.textContent = "Unable to fetch source code.";
  }

  const errorPopup = document.getElementById("errorPopup");
  errorPopup.style.display = "block";
  setTimeout(() => {
    errorPopup.style.opacity = "1";
    errorPopup.style.transform = "translate(-50%, -50%) scale(1)";
  }, 10); // Delay to ensure CSS transition for display and opacity
};

// Example Error (to trigger error popup)
//setTimeout(() => { nonExistentFunction(); }, 1000); // Triggers an error after 1 second
