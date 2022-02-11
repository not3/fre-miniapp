import workerdom from './worker-dom.js';
import { execScript } from './exec-script.js'
import { getCurrentPage } from './page.js'
import {global as ref} from './global'

let document = self.document = workerdom();
for (let i in document.defaultView) if (document.defaultView.hasOwnProperty(i)) {
    self[i] = document.defaultView[i];
}

let url = '/';

let COUNTER = 0;

const TO_SANITIZE = ['addedNodes', 'removedNodes', 'nextSibling', 'previousSibling', 'target'];

const PROP_BLACKLIST = ['children', 'parentNode', '__handlers', '_component', '_componentConstructor'];

const NODES = new Map();

function getNode(node) {
    let id;
    if (node && typeof node === 'object') id = node.__id;
    if (typeof node === 'string') id = node;
    if (!id) return null;
    if (node.nodeName === 'BODY') return document.body;
    return NODES.get(id);
}

function handleEvent(event) {
    let target = getNode(event.target);
    if (target) {
        event.target = target;
        event.bubbles = true;
        target.dispatchEvent(event);
    }
}

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) return obj.map(sanitize);

    if (obj instanceof document.defaultView.Node) {
        let id = obj.__id;
        if (!id) {
            id = obj.__id = String(++COUNTER);
        }
        NODES.set(id, obj);
    }

    let out = {};
    for (let i in obj) {
        if (obj.hasOwnProperty(i) && PROP_BLACKLIST.indexOf(i) < 0) {
            out[i] = obj[i];
        }
    }
    if (out.childNodes && out.childNodes.length) {
        out.childNodes = sanitize(out.childNodes);
    }
    return out;
}


(new MutationObserver(mutations => {
    for (let i = mutations.length; i--;) {
        let mutation = mutations[i];
        for (let j = TO_SANITIZE.length; j--;) {
            let prop = TO_SANITIZE[j];
            mutation[prop] = sanitize(mutation[prop]);
        }
    }
    send({ type: 'MutationRecord', mutations });
})).observe(document, { subtree: true });


function send(message) {
    postMessage(JSON.parse(JSON.stringify(message)));
}


/** Receive messages from the page */
addEventListener('message', ({ data }) => {
    switch (data.type) {
        case 'init':
            url = data.url;
            break;
        case 'event':
            handleEvent(data.event);
            break;
    }
});



const manifest = ref.JSSDK.readFileSync('demo/manifest.json')

const { scripts, styles } = JSON.parse(manifest).pages[0]
console.log(styles)

execScript('demo' + scripts[1], ref)
execScript('demo' + scripts[0], ref)

const page = getCurrentPage()

console.log(page)

console.log(ref)

const c = ref.modules['demo' + scripts[1]].default
let link = document.createElement('link')
link.setAttribute('href', 'http://localhost:5000/' + 'demo' + styles[0])
link.setAttribute('rel', 'stylesheet')
document.body.appendChild(link)
render(h(c, null), document.body)