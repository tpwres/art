import './marked.min.js'

class SlideshowController {
    current_slide = -1
    use_spare = false
    all_photos = []
    gallery_root = ''
    slide_change_time = 10000 // milliseconds = 10 seconds
    autoadvance = null

    allow_event = true
    allow_talent = true
    allow_venue = true
    allow_championship = true
    allow_article = true

    constructor(root, start) {
        this.element = root
        this.img_element = root.querySelector('.pic')
        this.spare_element = root.querySelector('.pic.spare')
        this.caption_element = root.querySelector('#caption')
        this.caption_text_element = root.querySelector('#caption .text')
        this.caption_src_element = root.querySelector('#caption .source')
        this.caption_info_element = root.querySelector('#caption .event')
        this.progress_element = root.querySelector('#caption progress')
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
        this.progress_element.addEventListener
        this.load_images()
    }

    load_images() {
        const event_photos = this.element.dataset.eventPhotos
        fetch(event_photos)
            .then(response => response.json())
            .then(data => {
                this.all_photos.push(...data)
                this.shuffle_photos()
            })
            .catch(error => console.error('Error:', error))

        const talent_photos = this.element.dataset.talentPhotos
        fetch(talent_photos)
            .then(response => response.json())
            .then(data => {
                this.all_photos.push(...data)
                this.shuffle_photos()
            })
            .catch(error => console.error('Error:', error))
    }

    read_controls() {
        const $ = (sel) => document.querySelector(sel)
        const speed_input = $('[name=speed]:checked')
        if (speed_input) {
            this.slide_change_time = Number(speed_input.value)
            console.log("SCT", this.slide_change_time)
        }

        this.display_progress = !!$('[name=progressbar_visible]:checked')

        this.allow_talent = !!$('[name=filter][value=talent]:checked')
        this.allow_event = !!$('[name=filter][value=event]:checked')
        this.allow_venue = !!$('[name=filter][value=venue]:checked')
        this.allow_championship = !!$('[name=filter][value=championship]:checked')
        this.allow_article = !!$('[name=filter][value=article]:checked')
        this.font_size = $('[name=font]:checked').value
        this.textbox_style = $('[name=text]:checked').value
    }

    start_slideshow() {
        this.read_controls()
        this.caption_element.className = ''
        this.caption_element.classList.add(`font-${this.font_size}`, `text-${this.textbox_style}`)

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
        while (true) {
            this.current_slide = (this.current_slide + 1) % this.all_photos.length
            const [_, photo] = this.all_photos[this.current_slide]
            if (photo.event && this.allow_event) break
            if (photo.venue && this.allow_venue) break
            if (photo.talent && this.allow_talent) break
            if (photo.championship && this.allow_championship) break
            if (photo.article && this.allow_article) break
        }

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
        this.reset_progress()
    }

    update_text(key, photo, left_or_right) {
        const [datestr, _num] = key.split('_')
        const date = new Date(`${datestr.slice(0, 4)}-${datestr.slice(4,6)}-${datestr.slice(6)}`)
        this.caption_src_element.textContent = ''
        const info = this.caption_info_element
        info.textContent = ''

        const { caption, source  } = photo
        this.caption_text_element.innerHTML = marked.parseInline(caption)
        if (source)
            this.caption_src_element.innerHTML = `Source: ${marked.parseInline(source)}`
        const { event, talent, org, venue, championship, article } = photo
        if (event)
            info.innerHTML = `${this.dtf.format(date)} ${marked.parseInline(event)}`
        else if (talent)
            info.innerHTML = `Talent: ${marked.parseInline(talent)}`
        else if (venue)
            info.innerHTML = `Venue: ${marked.parseInline(venue)}`
        else if (org)
            info.innerHTML = `Organization: ${marked.parseInline(org)}`
        else if (championship)
            info.innerHTML = `Championship: ${marked.parseInline(championship)}`
        else if (article)
            info.innerHTML = `Article: ${marked.parseInline(article)}`

        const caption_el = this.element.querySelector('#caption')
        caption_el.style.display = 'block'
        caption_el.classList.remove('left', 'right')
        caption_el.classList.add(left_or_right ? 'left' : 'right')
    }

    reset_progress() {
        this.progress_element.value = 0
        this.slide_start = new Date().valueOf() // Unix timestamp
        if (this.display_progress) {
            this.progress_element.style.display = 'inline'
            this.animate_progress()
        } else {
            this.progress_element.style.display = 'none'
        }
    }

    animate_progress() {
        requestAnimationFrame(() => {
            const now = new Date().valueOf()
            const progress = ((now - this.slide_start) / this.slide_change_time) * 100.0
            this.progress_element.value = progress
            if (progress < 100)
                requestAnimationFrame(this.animate_progress.bind(this))
        })
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
            this.caption_info_element.textContent = ''
            this.caption_src_element.textContent = ''
            const caption_el = this.element.querySelector('#caption')
            caption_el.style.display = 'none'
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

const root = document.querySelector('#slideshow-container')
const start = document.querySelector('#start-slideshow')
new SlideshowController(root, start)
