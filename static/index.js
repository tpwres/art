import './marked.min.js'

class SlideshowController {
    current_slide = -1
    use_spare = false
    all_photos = []
    gallery_root = ''
    slide_change_time = 10000 // milliseconds = 10 seconds
    autoadvance = null

    constructor(root, start) {
        this.element = root
        this.img_element = root.querySelector('.pic')
        this.spare_element = root.querySelector('.pic.spare')
        this.caption_text_element = root.querySelector('#caption .text')
        this.caption_src_element = root.querySelector('#caption .source')
        this.caption_event_element = root.querySelector('#caption .event')
        this.start_button = start

        this.gallery_root = root.dataset.galleryRoot
        this.dtf = new Intl.DateTimeFormat()
        marked.use({ hooks: { postprocess: this.postprocess_html.bind(this) } })
        this.connect()
    }

    connect() {
        this.start_button.addEventListener('click', this.start_slideshow.bind(this))
        this.element.addEventListener('fullscreenchange', this.fullscreen_change.bind(this))
        this.element.addEventListener('click', this.advance_and_reset_interval.bind(this))
        this.load_images()
    }

    load_images() {
        const path = this.element.dataset.eventPhotos
        fetch(path)
            .then(response => response.json())
            .then(data => {
                this.all_photos = data
                this.shuffle_photos()
            })
            .catch(error => console.error('Error:', error))
    }

    start_slideshow() {
        const speed_input = document.querySelector('[name=speed]:checked')
        if (speed_input) {
            this.slide_change_time = Number(speed_input.value)
            console.log("SCT", this.slide_change_time)
        }

        this.element.requestFullscreen()
            .then(() => this.advance_and_reset_interval())
            .catch(error => console.error('Fullscreen denied:', error))
    }

    advance_and_reset_interval() {
        this.advance_slide()
        if (this.autoadvance != null)
            clearInterval(this.autoadvance)
        this.autoadvance = setInterval(this.advance_slide.bind(this), this.slide_change_time)
    }

    advance_slide() {
        this.current_slide += 1
        const [key, photo] = this.all_photos[this.current_slide]
        const path = `${this.gallery_root}${photo.path}`
        const img_element = this.use_spare ? this.img_element : this.spare_element
        const other_img = this.use_spare ? this.spare_element : this.img_element
        this.use_spare = !this.use_spare

        const update_text = () => this.update_text(key, photo, this.use_spare)
        function crossfade() {
            img_element.style.opacity = '1'
            other_img.style.opacity = '0'
            update_text()
            img_element.removeEventListener('load', crossfade)
        }
        img_element.style.height = '100vh'
        // Start animation only after image loads
        img_element.addEventListener('load', crossfade)
        img_element.src = path
    }

    update_text(key, photo, left_or_right) {
        const [datestr, _num] = key.split('_')
        const date = new Date(`${datestr.slice(0, 4)}-${datestr.slice(4,6)}-${datestr.slice(6)}`)
        this.caption_src_element.textContent = ''
        this.caption_event_element.textContent = ''

        const { caption, source, event } = photo
        this.caption_text_element.innerHTML = marked.parseInline(caption)
        this.caption_event_element.innerHTML = `${this.dtf.format(date)} ${marked.parseInline(event)}`
        this.caption_src_element.innerHTML = `Source: ${marked.parseInline(source)}`
        const caption_el = this.element.querySelector('#caption')
        caption_el.style.display = 'block'
        caption_el.classList.remove('left', 'right')
        caption_el.classList.add(left_or_right ? 'left' : 'right')
    }

    shuffle_photos() {
        // Fisher-Yates shuffle
        for (let i = this.all_photos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.all_photos[i], this.all_photos[j]] = [this.all_photos[j], this.all_photos[i]];
        }
    }

    fullscreen_change(event) {
        if (document.fullscreenElement === null) {
            clearInterval(this.autoadvance)
            this.img_element.src = ''
            this.spare_element.src = ''
            this.caption_text_element.textContent = ''
            this.caption_event_element.textContent = ''
            this.caption_src_element.textContent = ''
        }
    }

    postprocess_html(html) {
        return html.replace(/href="([^"]*)"/g, (match, p1) => {
            if (p1.startsWith('@')) {
                return `href="//tpwres.pl${this.transform_path(p1)}"`
            }
            return match
        })
    }

    transform_path(path) {
        return path.replace(/^@(.*)\/(.*)\.md$/, (match, dir, filename) => {
           return `${dir}/${filename.replace(/[_]/g, '-')}` 
        })
    }



}

class NameFinderController {
    constructor(root, orgs_controller) {
        this.element = root
        this.nameTarget = root.querySelector('input[type=text]')
        this.matchesTarget = root.querySelector('ul#matches')
        this.headerTemplateTarget = root.querySelector('template#card-header')
        this.matchTemplateTarget = root.querySelector('template#card-match')
        this.orgs = orgs_controller
        this.connect()
    }
    connect() {
        this.populate_completion_list()
        this.load_matches()
        this.nameTarget.value = ''
        this.nameTarget.attributes.tabIndex = '1'
        const form = this.element.querySelector('form')
        form.addEventListener('submit', (event) => event.preventDefault())
        form.addEventListener('click', this.handle_buttons.bind(this))
        this.add_input_handlers(this.nameTarget)
        marked.use({ hooks: { postprocess: this.postprocess_html.bind(this) } })
    }

    add_input_handlers(element) {
    }

    ac_query(text) {
        const lc = text.toLowerCase()
        return this.name_list.filter(name => name.toLowerCase().includes(lc))
    }

    add_more() {
        const row = this.element.querySelector(".name-row:first-child")
        const clone = row.cloneNode(true)
        const input = clone.querySelector('input[type=text]')
        input.value = ''
        row.parentNode.insertAdjacentElement("beforeend", clone)
        this.add_input_handlers(input)
    }

    del_row(event) {
        const row = event.target.closest(".name-row")
        row.parentNode.removeChild(row)
        this.lookup()
    }

    handle_buttons(event) {
        if (event.target.tagName != 'BUTTON') return
        if (event.target.className == 'add-name')
            this.add_more()
        else if (event.target.className == 'remove')
            this.del_row(event)
    }

    async load_matches() {
        const path = this.element.dataset.matches
        fetch(path)
            .then(response => response.json())
            .then(data => {
                this.all_matches = data
            })
            .catch(error => console.error('Error:', error))
    }

    async populate_completion_list() {
        const path = this.element.dataset.appearances
        fetch(path)
            .then(response => response.json())
            .then(data => {
                this.appearances = data
                this.name_list = Object.keys(data)
            })
            .catch(error => console.error('Error:', error))
    }

    all_names() {
        const inputs = this.element.querySelectorAll('input[type=text]')
        return Array.prototype.map.call(inputs, (el) => el.value)
    }

    lookup() {
        const names = this.all_names()
        const first = names.shift()
        const matches = this.appearances[first]
        if (!matches) {
            this.empty_result()
            return
        }
        let indices = matches.map(el => el[0])

        for (const other of names) {
            if (other == '') continue
            let other_matches = this.appearances[other]
            if (!other_matches) {
                this.empty_result()
                return
            }
            let other_indices = other_matches.map(el => el[0])
            indices = indices.filter(value => other_indices.includes(value))
        }

        if (indices.length == 0) {
            this.empty_result()
            return
        }
        this.show_matches(indices)
    }

    empty_result() {
        const header = this.headerTemplateTarget.content.cloneNode(true)
        this.matchesTarget.innerHTML = ''
        this.matchesTarget.appendChild(header)
    }

    show_matches(indices) {
        const header = this.headerTemplateTarget.content.cloneNode(true)
        this.matchesTarget.innerHTML = ''
        this.matchesTarget.appendChild(header)
        const match_template = this.matchTemplateTarget.content

        const matches = indices.map((index) => structuredClone(this.all_matches[index]))
        matches.sort((a, b) => new Date(b.d) - new Date(a.d))

        for (const match of matches) {
            const t = match_template.cloneNode(true)

            const d = t.querySelector('.d')
            d.innerHTML = match['d']
            d.datetime = match['d']

            const o = t.querySelector('.o')
            for (const org of match['o']) {
                o.appendChild(this.orgs.get_badge(org))
            }

            const r = t.querySelector('.r')
            r.innerHTML = this.format_details(match)

            this.matchesTarget.appendChild(t)
        }
    }

    format_details(match) {
        let event_name = match.n
        let participants = match.m
        const { length, [length - 1]: last } = participants
        let options

        if (typeof last === 'object') {
            options = last
            participants.pop()
        } else
            options = {}

        let head = ''
        let participant_sep = ' and '
        let sep = options.nc ? ' vs ' : ' defeated '
        let end = options.nc ? ` - ${options.nc}` : options.r ? ` via ${options.r}` : ''
        if (end == '' && new Date(match.d) > new Date()) {
            end = ' - upcoming'
            sep = ' vs '
        }
        if (options.g) {
            participant_sep = ", "
            sep = ', '
            head = '<strong>Segment: </strong>'
        }

        const winner = participants.shift()
        const matchtype = options.s || 'Singles Match'
        const title = options.c || ''

        let text = head
        text += this.format_names(winner)
        if (participants.length > 0)
            text += sep
        text += participants.map((name) => this.format_names(name)).join(participant_sep)
        text += end
        text += '<br/>'

        if (title)
            text += `<strong>${marked.parseInline(title)}</strong> `
        text += `<strong>${marked.parseInline(matchtype)}</strong> at `
        text += this.format_link(event_name, match.p)

        return text
    }

    format_names(names) {
        // Split names on plus, comma or semicolon, then pass each name to format_name and join with the original symbols
        const splitNames = names.split(/(\s+(?:\+|,|;)\s+)/);
        return splitNames.map((part) => {
            // Only format the parts that are names, not the delimiters
            if (part.match(/(\s+(?:\+|,|;)\s+)/)) {
                return part;
            } else {
                return marked.parseInline(part)
            }
        }).join('');
    }


    format_link(title, target) {
        return marked.parseInline(`[${title}](@/${target})`)
    }
}

class OrgsController {
    constructor(root) {
        this.element = root
    }
    get_badge(org) {
        const id = `#org-badge-${org}`
        const el = this.element.querySelector(id)
        if (el)
            return el.content.cloneNode(true)

        let badge = document.getElementById('org-badge-zzz').content.cloneNode(true)
        badge.querySelector('a.org-badge span').textContent = org.toUpperCase()
        badge.querySelector('a.org-badge').href = this.org_link(org)
        return badge
    }

    org_link(org) {
        return `//tpwres.pl/o/${org}`
    }
}

const root = document.querySelector('#slideshow-container')
const start = document.querySelector('#start-slideshow')
new SlideshowController(root, start)
