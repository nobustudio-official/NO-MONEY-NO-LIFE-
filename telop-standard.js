/* Presentation only: opt-in captions keep their caller's progression handlers. */
(function () {
    'use strict';
    const panels = new WeakMap();

    function apply(panel, { message, portrait, next, speaker, notice, reserveSpace = false, passive = false } = {}) {
        if (!panel) return null;
        let record = panels.get(panel);
        if (!record) {
            let frame = panel;
            if (reserveSpace) {
                // Keep the original grid row so the upper panel retains its layout.
                frame = document.createElement('div');
                frame.append(...panel.childNodes);
                panel.append(frame);
                panel.classList.add('telop-layout-slot');
            }
            record = { frame, message: null, observer: null };
            panels.set(panel, record);
        }
        const frame = record.frame;
        if (!message) {
            message = record.message;
            if (!message) {
                message = document.createElement('p');
                message.append(...frame.childNodes);
                frame.append(message);
            }
        }
        frame.classList.add('telop-standard-frame');
        message.classList.add('telop-standard-copy');
        if (portrait) portrait.classList.add('telop-standard-portrait');
        if (next) next.classList.add('telop-standard-next');
        if (speaker) speaker.classList.add('telop-standard-speaker');
        if (notice && notice.parentElement !== message) message.append(notice);
        frame.classList.toggle('telop-no-portrait', !portrait || portrait.hidden || !portrait.getAttribute('src'));
        frame.classList.toggle('telop-has-speaker', Boolean(speaker?.textContent.trim()));
        frame.toggleAttribute('data-telop-passive', passive);
        if (record.message !== message) {
            record.observer?.disconnect();
            record.message = message;
            record.observer = new MutationObserver(() => window.CommonAnnouncements?.fitText(message));
            record.observer.observe(message, { childList: true, characterData: true, subtree: true });
        }
        window.CommonAnnouncements?.fitText(message);
        return frame;
    }

    window.TelopStandard = Object.freeze({ apply });
})();
