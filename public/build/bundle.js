
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    /* src\App.svelte generated by Svelte v3.31.2 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (54:7) {#each unidades as unidade}
    function create_each_block_2(ctx) {
    	let option;
    	let t_value = /*unidade*/ ctx[8].nome + "";
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = ctx[8].id;
    			option.value = option.__value;
    			add_location(option, file, 54, 7, 1958);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(54:7) {#each unidades as unidade}",
    		ctx
    	});

    	return block;
    }

    // (63:3) {#if valorParaCalculo}
    function create_if_block(ctx) {
    	let div;
    	let div_transition;
    	let current;
    	let each_value_1 = /*results*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "row mt-4 row justify-content-md-center mt-4");
    			add_location(div, file, 63, 4, 2118);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*results, calcularMedida*/ 20) {
    				each_value_1 = /*results*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { delay: 250, duration: 300 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { delay: 250, duration: 300 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(63:3) {#if valorParaCalculo}",
    		ctx
    	});

    	return block;
    }

    // (65:4) {#each results as result}
    function create_each_block_1(ctx) {
    	let span1;
    	let span0;
    	let t0_value = /*calcularMedida*/ ctx[4](/*result*/ ctx[11].multiplicador) + "";
    	let t0;
    	let t1;
    	let t2_value = /*result*/ ctx[11].nome + "";
    	let t2;

    	const block = {
    		c: function create() {
    			span1 = element("span");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			set_style(span0, "font-size", "20px");
    			add_location(span0, file, 65, 60, 2315);
    			attr_dev(span1, "class", "badge badge-pill badge-secondary m-2 p-3");
    			add_location(span1, file, 65, 5, 2260);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span1, anchor);
    			append_dev(span1, span0);
    			append_dev(span0, t0);
    			append_dev(span1, t1);
    			append_dev(span1, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*results*/ 4 && t0_value !== (t0_value = /*calcularMedida*/ ctx[4](/*result*/ ctx[11].multiplicador) + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*results*/ 4 && t2_value !== (t2_value = /*result*/ ctx[11].nome + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(65:4) {#each results as result}",
    		ctx
    	});

    	return block;
    }

    // (74:5) {#each unidades as unidade}
    function create_each_block(ctx) {
    	let br;
    	let t0;
    	let b;
    	let t1;
    	let t2_value = /*unidade*/ ctx[8].nome + "";
    	let t2;
    	let t3;
    	let t4_value = /*unidade*/ ctx[8].multiplicador + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			br = element("br");
    			t0 = space();
    			b = element("b");
    			t1 = text("1 ");
    			t2 = text(t2_value);
    			t3 = text(" equivale a ");
    			t4 = text(t4_value);
    			t5 = text("m²,");
    			add_location(br, file, 74, 5, 2680);
    			add_location(b, file, 75, 6, 2691);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, br, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, b, anchor);
    			append_dev(b, t1);
    			append_dev(b, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(b);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(74:5) {#each unidades as unidade}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let body;
    	let div9;
    	let div0;
    	let h1;
    	let t2;
    	let div1;
    	let h40;
    	let t4;
    	let div5;
    	let div4;
    	let div3;
    	let input;
    	let t5;
    	let div2;
    	let select;
    	let t6;
    	let t7;
    	let div7;
    	let div6;
    	let h41;
    	let t9;
    	let br0;
    	let t10;
    	let br1;
    	let t11;
    	let t12;
    	let h3;
    	let t14;
    	let div8;
    	let iframe;
    	let iframe_src_value;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_2 = /*unidades*/ ctx[3];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let if_block = /*valorParaCalculo*/ ctx[0] && create_if_block(ctx);
    	let each_value = /*unidades*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			t0 = space();
    			body = element("body");
    			div9 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Calculadora de Área";
    			t2 = space();
    			div1 = element("div");
    			h40 = element("h4");
    			h40.textContent = "Faça o calculo automático de transformação de área.";
    			t4 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			input = element("input");
    			t5 = space();
    			div2 = element("div");
    			select = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t6 = space();
    			if (if_block) if_block.c();
    			t7 = space();
    			div7 = element("div");
    			div6 = element("div");
    			h41 = element("h4");
    			h41.textContent = "Insira um valor no campo para calcular";
    			t9 = space();
    			br0 = element("br");
    			t10 = text("Dados utilizados:");
    			br1 = element("br");
    			t11 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t12 = space();
    			h3 = element("h3");
    			h3.textContent = "Dica do dia: Administre sua propriedade corretamente e comece a lucrar.";
    			t14 = space();
    			div8 = element("div");
    			iframe = element("iframe");
    			attr_dev(h1, "class", "mt-5");
    			add_location(h1, file, 42, 3, 1418);
    			attr_dev(div0, "class", "row justify-content-md-center");
    			add_location(div0, file, 41, 2, 1371);
    			add_location(h40, file, 45, 3, 1518);
    			attr_dev(div1, "class", "row justify-content-md-center");
    			add_location(div1, file, 44, 2, 1471);
    			attr_dev(input, "type", "number");
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "aria-label", "Text input with dropdown button");
    			add_location(input, file, 50, 5, 1697);
    			attr_dev(select, "id", "unidade");
    			if (/*unidadeSelecionadaId*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[6].call(select));
    			add_location(select, file, 52, 6, 1860);
    			attr_dev(div2, "class", "input-group-append");
    			add_location(div2, file, 51, 5, 1821);
    			attr_dev(div3, "class", "input-group");
    			add_location(div3, file, 49, 4, 1666);
    			attr_dev(div4, "class", "col-6");
    			add_location(div4, file, 48, 3, 1642);
    			attr_dev(div5, "class", "row justify-content-md-center mt-4");
    			add_location(div5, file, 47, 2, 1590);
    			add_location(h41, file, 71, 4, 2562);
    			add_location(br0, file, 72, 5, 2616);
    			add_location(br1, file, 72, 26, 2637);
    			attr_dev(div6, "class", "alert alert-info");
    			attr_dev(div6, "role", "alert");
    			add_location(div6, file, 70, 4, 2514);
    			attr_dev(div7, "class", "row mt-4 row justify-content-md-center mt-4");
    			add_location(div7, file, 69, 3, 2452);
    			attr_dev(h3, "class", " mt-2");
    			add_location(h3, file, 79, 3, 2792);
    			set_style(iframe, "position", "absolute");
    			set_style(iframe, "width", "100%");
    			set_style(iframe, "height", "100%");
    			set_style(iframe, "top", "0");
    			set_style(iframe, "left", "0");
    			set_style(iframe, "border", "none");
    			set_style(iframe, "padding", "0");
    			set_style(iframe, "margin", "0");
    			if (iframe.src !== (iframe_src_value = "https://www.canva.com/design/DAEP4JWTjOM/view?embed")) attr_dev(iframe, "src", iframe_src_value);
    			add_location(iframe, file, 80, 255, 3143);
    			set_style(div8, "position", "relative");
    			set_style(div8, "width", "100%");
    			set_style(div8, "height", "0");
    			set_style(div8, "padding-top", "56.2500%");
    			set_style(div8, "padding-bottom", "48px");
    			set_style(div8, "box-shadow", "0 2px 8px 0 rgba(63,69,81,0.16)");
    			set_style(div8, "margin-top", "1.6em");
    			set_style(div8, "margin-bottom", "0.9em");
    			set_style(div8, "overflow", "hidden");
    			set_style(div8, "border-radius", "8px");
    			set_style(div8, "will-change", "transform");
    			add_location(div8, file, 80, 3, 2891);
    			attr_dev(div9, "class", "container");
    			add_location(div9, file, 40, 1, 1345);
    			attr_dev(body, "class", "svelte-bnosbg");
    			add_location(body, file, 39, 0, 1337);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, body, anchor);
    			append_dev(body, div9);
    			append_dev(div9, div0);
    			append_dev(div0, h1);
    			append_dev(div9, t2);
    			append_dev(div9, div1);
    			append_dev(div1, h40);
    			append_dev(div9, t4);
    			append_dev(div9, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, input);
    			set_input_value(input, /*valorParaCalculo*/ ctx[0]);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, select);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(select, null);
    			}

    			select_option(select, /*unidadeSelecionadaId*/ ctx[1]);
    			append_dev(div9, t6);
    			if (if_block) if_block.m(div9, null);
    			append_dev(div9, t7);
    			append_dev(div9, div7);
    			append_dev(div7, div6);
    			append_dev(div6, h41);
    			append_dev(div6, t9);
    			append_dev(div6, br0);
    			append_dev(div6, t10);
    			append_dev(div6, br1);
    			append_dev(div6, t11);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			append_dev(div9, t12);
    			append_dev(div9, h3);
    			append_dev(div9, t14);
    			append_dev(div9, div8);
    			append_dev(div8, iframe);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*valorParaCalculo*/ 1 && to_number(input.value) !== /*valorParaCalculo*/ ctx[0]) {
    				set_input_value(input, /*valorParaCalculo*/ ctx[0]);
    			}

    			if (dirty & /*unidades*/ 8) {
    				each_value_2 = /*unidades*/ ctx[3];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*unidadeSelecionadaId, unidades*/ 10) {
    				select_option(select, /*unidadeSelecionadaId*/ ctx[1]);
    			}

    			if (/*valorParaCalculo*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*valorParaCalculo*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div9, t7);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*unidades*/ 8) {
    				each_value = /*unidades*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div6, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(body);
    			destroy_each(each_blocks_1, detaching);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let results;
    	let unidadeSelecionada;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	let unidades = [
    		{
    			"id": 1,
    			"nome": "Metro(s)²",
    			"multiplicador": 1
    		},
    		{
    			"id": 2,
    			"nome": "Hectare(s)",
    			"multiplicador": 10000
    		},
    		{
    			"id": 3,
    			"nome": "Alqueire(s)",
    			"multiplicador": 24200
    		},
    		{
    			"id": 4,
    			"nome": "Alqueire(s) do Norte",
    			"multiplicador": 27225
    		},
    		{
    			"id": 5,
    			"nome": "Alqueire(s) Mineiro",
    			"multiplicador": 48400
    		},
    		{
    			"id": 5,
    			"nome": "Alqueire(s) Baiano",
    			"multiplicador": 96800
    		}
    	];

    	let valorParaCalculo;
    	let unidadeSelecionadaId = 1;

    	// Função usada apenas para calcular os valores e mostrar na tela. 
    	// Essa função é chamada direto no HTML lá em baixo, dentro do {#each}.
    	function calcularMedida(multiplicador) {
    		const result = valorParaCalculo * unidadeSelecionada.multiplicador / multiplicador;

    		if (isNaN(result)) {
    			return "0,00";
    		}

    		return result.toFixed(4).toString().replace(".", ",");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		valorParaCalculo = to_number(this.value);
    		$$invalidate(0, valorParaCalculo);
    	}

    	function select_change_handler() {
    		unidadeSelecionadaId = select_value(this);
    		$$invalidate(1, unidadeSelecionadaId);
    		$$invalidate(3, unidades);
    	}

    	$$self.$capture_state = () => ({
    		tick,
    		slide,
    		unidades,
    		valorParaCalculo,
    		unidadeSelecionadaId,
    		calcularMedida,
    		results,
    		unidadeSelecionada
    	});

    	$$self.$inject_state = $$props => {
    		if ("unidades" in $$props) $$invalidate(3, unidades = $$props.unidades);
    		if ("valorParaCalculo" in $$props) $$invalidate(0, valorParaCalculo = $$props.valorParaCalculo);
    		if ("unidadeSelecionadaId" in $$props) $$invalidate(1, unidadeSelecionadaId = $$props.unidadeSelecionadaId);
    		if ("results" in $$props) $$invalidate(2, results = $$props.results);
    		if ("unidadeSelecionada" in $$props) unidadeSelecionada = $$props.unidadeSelecionada;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*valorParaCalculo, unidadeSelecionadaId*/ 3) {
    			// Toda vez que o valorParaCalculo ou unidadeSelecionadaId mudarem, o results é recalculado.
    			 $$invalidate(2, results = valorParaCalculo && unidades.filter(unidade => unidade.id != unidadeSelecionadaId));
    		}

    		if ($$self.$$.dirty & /*unidadeSelecionadaId*/ 2) {
    			// Toda vez que o unidadeSelecionadaId mudar, a unidadeSelecionada é filtrada novamente.
    			 unidadeSelecionada = unidades.find(unidade => unidade.id == unidadeSelecionadaId);
    		}
    	};

    	return [
    		valorParaCalculo,
    		unidadeSelecionadaId,
    		results,
    		unidades,
    		calcularMedida,
    		input_input_handler,
    		select_change_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
