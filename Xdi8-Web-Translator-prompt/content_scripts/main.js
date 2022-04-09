/**
 * Check if a string contains Chinese characters.
 * @param {String} s The string to be checked
 * @return {Boolean} If the string contains at least one Chinese character,
 * returns true. Otherwise returns false.
 */
function hasHanChar(s) {
    const r = /[〆〇一-鿿㐀-䶿𠀀-𪛟𪜀-𫜿𫝀-𫠟𫠠-𬺯𬺰-𮯯𰀀-𱍏]/u;
    return Boolean(s.match(r));
}

/**
 * Determine whether an HTML element should be handled by inject-xdi8
 * by checking its lang tag.
 * @param {String} lang The lang tag of an HTML element
 * @return {Boolean} If the lang tag is reasonable to be handled, returns
 * true. Otherwise returns false.
 */
function isTargetLang(lang) {
    return true;  // all lang tags are expected to be injected
}

/**
 * Create a ruby element with the character and the pronunciation.
 * @param {String} ch The character in a ruby element
 * @param {String} pronunciation The pronunciation in a ruby element
 * @return {Element} The ruby element
 */


function makeRubyTorch(ch, pronunciation, mold/*, isbig*/) {
   // pronunciation = ((isbig) ? "^" : "") + pronunciation;
    const ruby = document.createElement('ruby');
    ruby.classList.add('inject-xdi8');
    ruby.lang = 'art-x-xd';
    ruby.innerText = pronunciation;
    ruby.style.marginRight = "0.26em";

    ruby.style.fontFamily = "'XEGO', sans-serif";
   // ruby.style.fontFeatureSettings = "'ccmp'";

    const rp_left = document.createElement('rp');
    rp_left.appendChild(document.createTextNode('('));
    ruby.appendChild(rp_left);

    const rt = document.createElement('rt');
    rt.innerText = ch;
    ruby.appendChild(rt);
    rt.style.marginBottom = "-0.26em";
    rt.style.visibility = "hidden";
    if (!mold) {
        ruby.onclick = function () {
            rt.style.visibility = "visible";
            setTimeout(function () {
                rt.style.visibility = "hidden";
            }
                , 900);
        };
    }
    else {
        ruby.onmouseover = function () {
            rt.style.visibility = "visible";
        };
        ruby.onmouseleave = function () {
            setTimeout(function () {
                rt.style.visibility = "hidden";
            }
                , 900);
        };
    }
    const rp_right = document.createElement('rp');
    rp_right.appendChild(document.createTextNode(')'));
    ruby.appendChild(rp_right);

    return ruby;
}

function makeNomalText(ch) {
    const sym1 = [['，', '。', '！', '？', '、', '：', '；'], [',', '.', '!', '?', '､', ':', ';']];
    const sym2 = [['（', '）', '【', '】', '“', '”'], ['(', ')', '[', ']', '"', '"']];

    if (sym1[0].includes(ch)) {
        var cht = ch;
        for (let i of sym1[0]) {
            if (cht == i) {
                cht = sym1[1][sym1[0].indexOf(i)];
            }
        }
        const ruby = document.createElement('span');
        ruby.innerText = cht;
        ruby.style.marginRight = "0.52em";
        ruby.style.marginLeft = "-0.22em";
        return ruby;
    }
    else if (sym2[0].includes(ch)) {
        var cht = ch;
        for (let i of sym2[0]) {
            if (cht == i) {
                cht = sym2[1][sym2[0].indexOf(i)];
            }
        }
        const ruby = document.createElement('span');
        ruby.innerText = cht;
        ruby.style.marginRight = "0.26em";
        return ruby;
    }
    else {
        return document.createTextNode(ch);
    }
}

const port = browser.runtime.connect();
const mm = new MessageManager(port);

async function recursiveConvert(currentNode, langMatched) {
    // Ignore certain HTML elements
    if (['RUBY', 'OPTION', 'TEXTAREA', 'SCRIPT', 'STYLE'].includes(currentNode.tagName)) {
        return;
    }


    if (currentNode.lang && currentNode.lang.length) {
        langMatched = isTargetLang(currentNode.lang);
    }


    const substitutionArray = [];

    for (const node of currentNode.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (!langMatched || !hasHanChar(node.nodeValue)) {
                continue;
            }

            const newNodes = document.createDocumentFragment();
            const conversionResults = await mm.sendMessage('convert', node.nodeValue);  // From background script

            //let s = true;
            for (const [k, v] of conversionResults) {
                newNodes.appendChild(v === null ? makeNomalText(k) : makeRubyTorch(k, v, ['A', 'INPUT'].includes(currentNode.tagName)/*, s*/));
                //s = false;
                //if (['。', '<br>', '！', '？', '“', '”', '「', '」'].includes(k)) {
                //    s = true;
                //}
            }
            substitutionArray.push([newNodes, node]);
        } else {
            await recursiveConvert(node, langMatched);
        }
    }

    for (const [newNodes, node] of substitutionArray) {
        currentNode.replaceChild(newNodes, node);
    }
}

async function init() {
    const lang = document.body.lang || document.documentElement.lang || 'en';
    await recursiveConvert(document.body, isTargetLang(lang));
}

browser.runtime.onMessage.addListener(msg => {
    if (msg.name === 'do-inject-xdi8') {
        init();
    }
});

async function autoInit() {
    if ((await browser.storage.local.get('enabled'))['enabled'] !== false) {
        init();
    }
}

autoInit();
