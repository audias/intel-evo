
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
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
    function empty() {
        return text('');
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
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
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
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/components/custom/CloseDevice.svelte generated by Svelte v3.29.0 */
    const file = "src/components/custom/CloseDevice.svelte";

    function create_fragment(ctx) {
    	let div2;
    	let div0;
    	let img;
    	let img_src_value;
    	let t;
    	let div1;
    	let p;

    	let raw_value = (/*open*/ ctx[3]
    	? /*copy*/ ctx[0].close_device
    	: /*copy*/ ctx[0].open_device) + "";

    	let p_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t = space();
    			div1 = element("div");
    			p = element("p");
    			attr_dev(img, "class", "img");

    			if (img.src !== (img_src_value = /*open*/ ctx[3]
    			? /*image*/ ctx[1]
    			: /*imageSelected*/ ctx[2])) attr_dev(img, "src", img_src_value);

    			attr_dev(img, "alt", "close-device");
    			add_location(img, file, 83, 4, 2253);
    			attr_dev(div0, "class", "img-container svelte-1ot4qyg");
    			add_location(div0, file, 82, 2, 2221);

    			attr_dev(p, "class", p_class_value = "" + (null_to_empty(/*open*/ ctx[3]
    			? "close-device-normal"
    			: "close-device-selected") + " svelte-1ot4qyg"));

    			add_location(p, file, 86, 4, 2361);
    			attr_dev(div1, "class", "text svelte-1ot4qyg");
    			add_location(div1, file, 85, 2, 2338);
    			attr_dev(div2, "class", "close-device svelte-1ot4qyg");
    			attr_dev(div2, "id", "closeBtn");
    			add_location(div2, file, 81, 0, 2157);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, img);
    			append_dev(div2, t);
    			append_dev(div2, div1);
    			append_dev(div1, p);
    			p.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = listen_dev(div2, "click", /*playRange*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*open, image, imageSelected*/ 14 && img.src !== (img_src_value = /*open*/ ctx[3]
    			? /*image*/ ctx[1]
    			: /*imageSelected*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*open, copy*/ 9 && raw_value !== (raw_value = (/*open*/ ctx[3]
    			? /*copy*/ ctx[0].close_device
    			: /*copy*/ ctx[0].open_device) + "")) p.innerHTML = raw_value;
    			if (dirty & /*open*/ 8 && p_class_value !== (p_class_value = "" + (null_to_empty(/*open*/ ctx[3]
    			? "close-device-normal"
    			: "close-device-selected") + " svelte-1ot4qyg"))) {
    				attr_dev(p, "class", p_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			dispose();
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

    function removeHotspots() {
    	var liElements = document.getElementsByClassName("svelte-fakij8");

    	for (var i = 0; i < liElements.length; ++i) {
    		liElements[i].style.opacity = 0.9;
    		liElements[i].style.pointerEvents = "none";
    	}

    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		hotspots[i].removeAttribute("data-visible");
    	}
    }

    function showHotspots() {
    	var liElements = document.getElementsByClassName("svelte-fakij8");

    	for (var i = 0; i < liElements.length; ++i) {
    		liElements[i].style.opacity = 1;
    		liElements[i].style.pointerEvents = "";
    	}

    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		hotspots[i].setAttribute("data-visible", "");
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("CloseDevice", slots, []);
    	let { copy } = $$props;
    	let { image } = $$props;
    	let { imageSelected } = $$props;
    	let modelViewer = "";
    	let open = true;
    	let animationFinished = true;

    	onMount(() => {
    		modelViewer = document.getElementById("unit01");
    	});

    	function playRange() {
    		let animationPause;
    		modelViewer.play();

    		if (open & animationFinished) {
    			animationFinished = false;
    			removeHotspots();
    			modelViewer.currentTime = "3";

    			animationPause = setTimeout(
    				function () {
    					modelViewer.pause();
    					$$invalidate(3, open = false);
    					animationFinished = true;
    				},
    				1000
    			);
    		} else if (!open && animationFinished) {
    			animationFinished = false;
    			modelViewer.currentTime = "5";

    			animationPause = setTimeout(
    				function () {
    					modelViewer.pause();
    					$$invalidate(3, open = true);
    					showHotspots();
    					animationFinished = true;
    				},
    				600
    			);
    		}
    	}

    	const writable_props = ["copy", "image", "imageSelected"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CloseDevice> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("image" in $$props) $$invalidate(1, image = $$props.image);
    		if ("imageSelected" in $$props) $$invalidate(2, imageSelected = $$props.imageSelected);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		copy,
    		image,
    		imageSelected,
    		modelViewer,
    		open,
    		animationFinished,
    		playRange,
    		removeHotspots,
    		showHotspots
    	});

    	$$self.$inject_state = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("image" in $$props) $$invalidate(1, image = $$props.image);
    		if ("imageSelected" in $$props) $$invalidate(2, imageSelected = $$props.imageSelected);
    		if ("modelViewer" in $$props) modelViewer = $$props.modelViewer;
    		if ("open" in $$props) $$invalidate(3, open = $$props.open);
    		if ("animationFinished" in $$props) animationFinished = $$props.animationFinished;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [copy, image, imageSelected, open, playRange];
    }

    class CloseDevice extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { copy: 0, image: 1, imageSelected: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CloseDevice",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*copy*/ ctx[0] === undefined && !("copy" in props)) {
    			console.warn("<CloseDevice> was created without expected prop 'copy'");
    		}

    		if (/*image*/ ctx[1] === undefined && !("image" in props)) {
    			console.warn("<CloseDevice> was created without expected prop 'image'");
    		}

    		if (/*imageSelected*/ ctx[2] === undefined && !("imageSelected" in props)) {
    			console.warn("<CloseDevice> was created without expected prop 'imageSelected'");
    		}
    	}

    	get copy() {
    		throw new Error("<CloseDevice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set copy(value) {
    		throw new Error("<CloseDevice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<CloseDevice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<CloseDevice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get imageSelected() {
    		throw new Error("<CloseDevice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set imageSelected(value) {
    		throw new Error("<CloseDevice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.29.0 */
    const file$1 = "src/components/Footer.svelte";

    function create_fragment$1(ctx) {
    	let div4;
    	let div3;
    	let div1;
    	let closedevice;
    	let t0;
    	let div0;
    	let p0;
    	let t1_value = /*copy*/ ctx[0].legal.copy + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3_value = /*copy*/ ctx[0].legal.link + "";
    	let t3;
    	let t4;
    	let div2;
    	let img;
    	let img_src_value;
    	let current;
    	let mounted;
    	let dispose;

    	closedevice = new CloseDevice({
    			props: {
    				copy: /*copy*/ ctx[0],
    				imageSelected: /*openDevice*/ ctx[2],
    				image: /*closeDevice*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			create_component(closedevice.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			p0 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text(t3_value);
    			t4 = space();
    			div2 = element("div");
    			img = element("img");
    			attr_dev(p0, "class", "svelte-33sagv");
    			add_location(p0, file$1, 53, 8, 1358);
    			attr_dev(p1, "class", "legal-link svelte-33sagv");
    			add_location(p1, file$1, 54, 8, 1391);
    			attr_dev(div0, "class", "legal-copy-container svelte-33sagv");
    			add_location(div0, file$1, 52, 6, 1315);
    			attr_dev(div1, "class", "close-legal-container svelte-33sagv");
    			add_location(div1, file$1, 50, 4, 1198);
    			attr_dev(img, "class", "img");
    			if (img.src !== (img_src_value = /*logo*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "evo checkmark");
    			add_location(img, file$1, 58, 6, 1518);
    			attr_dev(div2, "class", "evo-checkmark svelte-33sagv");
    			add_location(div2, file$1, 57, 4, 1484);
    			attr_dev(div3, "class", "container svelte-33sagv");
    			add_location(div3, file$1, 49, 2, 1170);
    			attr_dev(div4, "class", "footer svelte-33sagv");
    			add_location(div4, file$1, 48, 0, 1147);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			mount_component(closedevice, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, p0);
    			append_dev(p0, t1);
    			append_dev(div0, t2);
    			append_dev(div0, p1);
    			append_dev(p1, t3);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			append_dev(div2, img);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(p1, "click", /*openLegal*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const closedevice_changes = {};
    			if (dirty & /*copy*/ 1) closedevice_changes.copy = /*copy*/ ctx[0];
    			if (dirty & /*openDevice*/ 4) closedevice_changes.imageSelected = /*openDevice*/ ctx[2];
    			if (dirty & /*closeDevice*/ 2) closedevice_changes.image = /*closeDevice*/ ctx[1];
    			closedevice.$set(closedevice_changes);
    			if ((!current || dirty & /*copy*/ 1) && t1_value !== (t1_value = /*copy*/ ctx[0].legal.copy + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*copy*/ 1) && t3_value !== (t3_value = /*copy*/ ctx[0].legal.link + "")) set_data_dev(t3, t3_value);

    			if (!current || dirty & /*logo*/ 8 && img.src !== (img_src_value = /*logo*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(closedevice.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(closedevice.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(closedevice);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Footer", slots, []);
    	let { copy } = $$props;
    	let { closeDevice } = $$props;
    	let { openDevice } = $$props;
    	let { logo } = $$props;
    	const dispatch = createEventDispatcher();

    	function openLegal() {
    		dispatch("open-modal", true);
    	}

    	const writable_props = ["copy", "closeDevice", "openDevice", "logo"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("closeDevice" in $$props) $$invalidate(1, closeDevice = $$props.closeDevice);
    		if ("openDevice" in $$props) $$invalidate(2, openDevice = $$props.openDevice);
    		if ("logo" in $$props) $$invalidate(3, logo = $$props.logo);
    	};

    	$$self.$capture_state = () => ({
    		CloseDevice,
    		createEventDispatcher,
    		copy,
    		closeDevice,
    		openDevice,
    		logo,
    		dispatch,
    		openLegal
    	});

    	$$self.$inject_state = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("closeDevice" in $$props) $$invalidate(1, closeDevice = $$props.closeDevice);
    		if ("openDevice" in $$props) $$invalidate(2, openDevice = $$props.openDevice);
    		if ("logo" in $$props) $$invalidate(3, logo = $$props.logo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [copy, closeDevice, openDevice, logo, openLegal];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			copy: 0,
    			closeDevice: 1,
    			openDevice: 2,
    			logo: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*copy*/ ctx[0] === undefined && !("copy" in props)) {
    			console.warn("<Footer> was created without expected prop 'copy'");
    		}

    		if (/*closeDevice*/ ctx[1] === undefined && !("closeDevice" in props)) {
    			console.warn("<Footer> was created without expected prop 'closeDevice'");
    		}

    		if (/*openDevice*/ ctx[2] === undefined && !("openDevice" in props)) {
    			console.warn("<Footer> was created without expected prop 'openDevice'");
    		}

    		if (/*logo*/ ctx[3] === undefined && !("logo" in props)) {
    			console.warn("<Footer> was created without expected prop 'logo'");
    		}
    	}

    	get copy() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set copy(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeDevice() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeDevice(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get openDevice() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set openDevice(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get logo() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set logo(value) {
    		throw new Error("<Footer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Header.svelte generated by Svelte v3.29.0 */
    const file$2 = "src/components/Header.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let h3;
    	let t0;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t4;
    	let img1;
    	let img1_src_value;
    	let t5;
    	let img2;
    	let img2_src_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h3 = element("h3");
    			t0 = text(/*headline*/ ctx[0]);
    			t1 = space();
    			p = element("p");
    			t2 = text(/*subheadline*/ ctx[1]);
    			t3 = space();
    			div0 = element("div");
    			img0 = element("img");
    			t4 = space();
    			img1 = element("img");
    			t5 = space();
    			img2 = element("img");
    			attr_dev(h3, "class", "svelte-7wckle");
    			add_location(h3, file$2, 82, 2, 1830);
    			attr_dev(p, "class", "subheadline svelte-7wckle");
    			add_location(p, file$2, 83, 2, 1852);
    			attr_dev(img0, "id", "arrow01");
    			attr_dev(img0, "class", "img arrow svelte-7wckle");
    			if (img0.src !== (img0_src_value = /*arrow*/ ctx[2])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "down arrow");
    			add_location(img0, file$2, 85, 4, 1924);
    			attr_dev(img1, "id", "arrow02");
    			attr_dev(img1, "class", "img arrow svelte-7wckle");
    			if (img1.src !== (img1_src_value = /*arrow*/ ctx[2])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "down arrow");
    			add_location(img1, file$2, 86, 4, 1996);
    			attr_dev(img2, "id", "arrow03");
    			attr_dev(img2, "class", "img arrow svelte-7wckle");
    			if (img2.src !== (img2_src_value = /*arrow*/ ctx[2])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "down arrow");
    			add_location(img2, file$2, 87, 4, 2068);
    			attr_dev(div0, "class", "down-arrow svelte-7wckle");
    			add_location(div0, file$2, 84, 2, 1895);
    			attr_dev(div1, "class", "header svelte-7wckle");
    			add_location(div1, file$2, 81, 0, 1807);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h3);
    			append_dev(h3, t0);
    			append_dev(div1, t1);
    			append_dev(div1, p);
    			append_dev(p, t2);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, img0);
    			append_dev(div0, t4);
    			append_dev(div0, img1);
    			append_dev(div0, t5);
    			append_dev(div0, img2);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*headline*/ 1) set_data_dev(t0, /*headline*/ ctx[0]);
    			if (dirty & /*subheadline*/ 2) set_data_dev(t2, /*subheadline*/ ctx[1]);

    			if (dirty & /*arrow*/ 4 && img0.src !== (img0_src_value = /*arrow*/ ctx[2])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (dirty & /*arrow*/ 4 && img1.src !== (img1_src_value = /*arrow*/ ctx[2])) {
    				attr_dev(img1, "src", img1_src_value);
    			}

    			if (dirty & /*arrow*/ 4 && img2.src !== (img2_src_value = /*arrow*/ ctx[2])) {
    				attr_dev(img2, "src", img2_src_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function animation() {
    	var animation_TL = new TimelineMax();
    	animation_TL.add("init");
    	animation_TL.from("h3", 3, { y: "-200rem", ease: "Circ.easeOut" }, "init");
    	animation_TL.to("h3", 5, { opacity: 1, ease: "Circ.easeOut" }, "init");
    	animation_TL.to(".subheadline", 2, { opacity: 1, ease: "Circ.easeInOut" }, "init+=1.5");
    	animation_TL.to(".down-arrow", 1, { opacity: 0.6, ease: "Circ.easeInOut" }, "init+=2");
    	animation_TL.add("initLoop");

    	animation_TL.to(
    		arrow01,
    		1,
    		{
    			opacity: 0.8,
    			ease: "Circ.easeInOut",
    			repeat: -1,
    			yoyo: true
    		},
    		"initLoop"
    	);

    	animation_TL.to(
    		arrow02,
    		1,
    		{
    			opacity: 0.6,
    			ease: "Circ.easeInOut",
    			repeat: -1,
    			yoyo: true
    		},
    		"initLoop+=0.5"
    	);

    	animation_TL.to(
    		arrow03,
    		1,
    		{
    			opacity: 0.4,
    			ease: "Circ.easeInOut",
    			repeat: -1,
    			yoyo: true
    		},
    		"initLoop+=1"
    	);
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Header", slots, []);
    	let { headline = "" } = $$props;
    	let { subheadline = "" } = $$props;
    	let { arrow = "" } = $$props;

    	onMount(() => {
    		animation();
    	});

    	const writable_props = ["headline", "subheadline", "arrow"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("headline" in $$props) $$invalidate(0, headline = $$props.headline);
    		if ("subheadline" in $$props) $$invalidate(1, subheadline = $$props.subheadline);
    		if ("arrow" in $$props) $$invalidate(2, arrow = $$props.arrow);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		headline,
    		subheadline,
    		arrow,
    		animation
    	});

    	$$self.$inject_state = $$props => {
    		if ("headline" in $$props) $$invalidate(0, headline = $$props.headline);
    		if ("subheadline" in $$props) $$invalidate(1, subheadline = $$props.subheadline);
    		if ("arrow" in $$props) $$invalidate(2, arrow = $$props.arrow);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [headline, subheadline, arrow];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { headline: 0, subheadline: 1, arrow: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get headline() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set headline(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subheadline() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subheadline(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get arrow() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set arrow(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/FeaturesList.svelte generated by Svelte v3.29.0 */
    const file$3 = "src/components/FeaturesList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (63:4) {#each features as feature, i}
    function create_each_block(ctx) {
    	let li;
    	let div5;
    	let div2;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div1;
    	let t1_value = /*feature*/ ctx[6].copy + "";
    	let t1;
    	let t2;
    	let div4;
    	let div3;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let li_key_value;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[4](/*i*/ ctx[8], ...args);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			div5 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div1 = element("div");
    			t1 = text(t1_value);
    			t2 = space();
    			div4 = element("div");
    			div3 = element("div");
    			img1 = element("img");
    			t3 = space();
    			if (img0.src !== (img0_src_value = /*listCheckmark*/ ctx[1])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "checkmark");
    			attr_dev(img0, "class", "svelte-fakij8");
    			add_location(img0, file$3, 67, 14, 1739);
    			attr_dev(div0, "class", "checkmark svelte-fakij8");
    			add_location(div0, file$3, 66, 12, 1701);
    			attr_dev(div1, "class", "text");
    			add_location(div1, file$3, 69, 12, 1814);
    			attr_dev(div2, "class", "text-wrapper svelte-fakij8");
    			add_location(div2, file$3, 65, 10, 1662);
    			if (img1.src !== (img1_src_value = /*rightArrow*/ ctx[2])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "checkmark");
    			attr_dev(img1, "class", "svelte-fakij8");
    			add_location(img1, file$3, 73, 14, 1962);
    			attr_dev(div3, "class", "right-arrow svelte-fakij8");
    			add_location(div3, file$3, 72, 12, 1922);
    			attr_dev(div4, "class", "arrow-container svelte-fakij8");
    			add_location(div4, file$3, 71, 10, 1880);
    			attr_dev(div5, "class", "text-container svelte-fakij8");
    			add_location(div5, file$3, 64, 8, 1623);
    			attr_dev(li, "key", li_key_value = /*i*/ ctx[8]);
    			attr_dev(li, "class", "svelte-fakij8");
    			add_location(li, file$3, 63, 6, 1566);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, div5);
    			append_dev(div5, div2);
    			append_dev(div2, div0);
    			append_dev(div0, img0);
    			append_dev(div2, t0);
    			append_dev(div2, div1);
    			append_dev(div1, t1);
    			append_dev(div5, t2);
    			append_dev(div5, div4);
    			append_dev(div4, div3);
    			append_dev(div3, img1);
    			append_dev(li, t3);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*listCheckmark*/ 2 && img0.src !== (img0_src_value = /*listCheckmark*/ ctx[1])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (dirty & /*features*/ 1 && t1_value !== (t1_value = /*feature*/ ctx[6].copy + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*rightArrow*/ 4 && img1.src !== (img1_src_value = /*rightArrow*/ ctx[2])) {
    				attr_dev(img1, "src", img1_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(63:4) {#each features as feature, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let ul;
    	let each_value = /*features*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "svelte-fakij8");
    			add_location(ul, file$3, 61, 2, 1520);
    			attr_dev(div, "class", "features svelte-fakij8");
    			add_location(div, file$3, 60, 0, 1495);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*openDescription, rightArrow, features, listCheckmark*/ 15) {
    				each_value = /*features*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FeaturesList", slots, []);
    	let { features } = $$props;
    	let { listCheckmark } = $$props;
    	let { rightArrow } = $$props;
    	const dispatch = createEventDispatcher();

    	onMount(() => {
    		
    	}); // console.log("features list component has mounted");

    	function openDescription(key) {
    		dispatch("open-description", key);
    	}

    	const writable_props = ["features", "listCheckmark", "rightArrow"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FeaturesList> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => openDescription(i);

    	$$self.$$set = $$props => {
    		if ("features" in $$props) $$invalidate(0, features = $$props.features);
    		if ("listCheckmark" in $$props) $$invalidate(1, listCheckmark = $$props.listCheckmark);
    		if ("rightArrow" in $$props) $$invalidate(2, rightArrow = $$props.rightArrow);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		features,
    		listCheckmark,
    		rightArrow,
    		dispatch,
    		openDescription
    	});

    	$$self.$inject_state = $$props => {
    		if ("features" in $$props) $$invalidate(0, features = $$props.features);
    		if ("listCheckmark" in $$props) $$invalidate(1, listCheckmark = $$props.listCheckmark);
    		if ("rightArrow" in $$props) $$invalidate(2, rightArrow = $$props.rightArrow);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [features, listCheckmark, rightArrow, openDescription, click_handler];
    }

    class FeaturesList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			features: 0,
    			listCheckmark: 1,
    			rightArrow: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FeaturesList",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*features*/ ctx[0] === undefined && !("features" in props)) {
    			console.warn("<FeaturesList> was created without expected prop 'features'");
    		}

    		if (/*listCheckmark*/ ctx[1] === undefined && !("listCheckmark" in props)) {
    			console.warn("<FeaturesList> was created without expected prop 'listCheckmark'");
    		}

    		if (/*rightArrow*/ ctx[2] === undefined && !("rightArrow" in props)) {
    			console.warn("<FeaturesList> was created without expected prop 'rightArrow'");
    		}
    	}

    	get features() {
    		throw new Error("<FeaturesList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set features(value) {
    		throw new Error("<FeaturesList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get listCheckmark() {
    		throw new Error("<FeaturesList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set listCheckmark(value) {
    		throw new Error("<FeaturesList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rightArrow() {
    		throw new Error("<FeaturesList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rightArrow(value) {
    		throw new Error("<FeaturesList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/3DModel.svelte generated by Svelte v3.29.0 */
    const file$4 = "src/components/custom/3DModel.svelte";

    // (130:6) {#if modelTime >= 1.5}
    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let div3;
    	let div2;
    	let t1;
    	let div5;
    	let div4;
    	let t2;
    	let div7;
    	let div6;
    	let t3;
    	let div9;
    	let div8;
    	let t4;
    	let div11;
    	let div10;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div3 = element("div");
    			div2 = element("div");
    			t1 = space();
    			div5 = element("div");
    			div4 = element("div");
    			t2 = space();
    			div7 = element("div");
    			div6 = element("div");
    			t3 = space();
    			div9 = element("div");
    			div8 = element("div");
    			t4 = space();
    			div11 = element("div");
    			div10 = element("div");
    			attr_dev(div0, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div0, file$4, 140, 10, 3169);
    			attr_dev(div1, "class", "hotspot svelte-elcw9b");
    			attr_dev(div1, "slot", "hotspot-1");
    			attr_dev(div1, "alt", "hotspot");
    			attr_dev(div1, "data-position", "34.79234795624337m 65.32437590326577m -45.55737937168738m");
    			attr_dev(div1, "data-normal", "0.4m 1.5m 1m");
    			attr_dev(div1, "data-visibility-attribute", "visible");
    			set_style(div1, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div1, "id", "animation01");
    			add_location(div1, file$4, 130, 8, 2789);
    			attr_dev(div2, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div2, file$4, 152, 10, 3614);
    			attr_dev(div3, "class", "hotspot svelte-elcw9b");
    			attr_dev(div3, "slot", "hotspot-2");
    			attr_dev(div3, "alt", "hotspot");
    			attr_dev(div3, "data-position", "-18.143834681681702m 55.37506674662382m -42.541894858824016m");
    			attr_dev(div3, "data-normal", "0.4m 1.5m 1m");
    			attr_dev(div3, "data-visibility-attribute", "visible");
    			set_style(div3, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div3, "id", "animation02");
    			add_location(div3, file$4, 142, 8, 3231);
    			attr_dev(div4, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div4, file$4, 164, 10, 4054);
    			attr_dev(div5, "class", "hotspot svelte-elcw9b");
    			attr_dev(div5, "slot", "hotspot-3");
    			attr_dev(div5, "alt", "hotspot");
    			attr_dev(div5, "data-position", "41.8969581268581m 16.5195340272641m 15.839284639558091m");
    			attr_dev(div5, "data-normal", "0.4m 1.5m 1m");
    			attr_dev(div5, "data-visibility-attribute", "visible");
    			set_style(div5, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div5, "id", "animation03");
    			add_location(div5, file$4, 154, 8, 3676);
    			attr_dev(div6, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div6, file$4, 176, 10, 4497);
    			attr_dev(div7, "class", "hotspot svelte-elcw9b");
    			attr_dev(div7, "slot", "hotspot-4");
    			attr_dev(div7, "alt", "hotspot");
    			attr_dev(div7, "data-position", "21.920838532993624m 11.863674898982934m 24.57488663414014m");
    			attr_dev(div7, "data-normal", "0.4m 1.5m 1m");
    			attr_dev(div7, "data-visibility-attribute", "visible");
    			set_style(div7, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div7, "id", "animation04");
    			add_location(div7, file$4, 166, 8, 4116);
    			attr_dev(div8, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div8, file$4, 188, 10, 4896);
    			attr_dev(div9, "class", "hotspot svelte-elcw9b");
    			attr_dev(div9, "slot", "hotspot-5");
    			attr_dev(div9, "alt", "hotspot");
    			attr_dev(div9, "data-position", "-39m 17m -31m");
    			attr_dev(div9, "data-normal", "-0.4m 1.5m 1m");
    			attr_dev(div9, "data-visibility-attribute", "visible");
    			set_style(div9, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div9, "id", "animation05");
    			add_location(div9, file$4, 178, 8, 4559);
    			attr_dev(div10, "class", "circle scale-in-center svelte-elcw9b");
    			add_location(div10, file$4, 200, 10, 5324);
    			attr_dev(div11, "class", "hotspot svelte-elcw9b");
    			attr_dev(div11, "slot", "hotspot-6");
    			attr_dev(div11, "alt", "hotspot");
    			attr_dev(div11, "data-position", "-45.40461292837645m 7.5m -17.247609303219338m");
    			attr_dev(div11, "data-normal", "0.4m 1m 1m");
    			attr_dev(div11, "data-visibility-attribute", "visible");
    			set_style(div11, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			attr_dev(div11, "id", "animation06");
    			add_location(div11, file$4, 190, 8, 4958);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div6);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div9, anchor);
    			append_dev(div9, div8);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, div10);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*click_handler*/ ctx[10], false, false, false),
    					listen_dev(div3, "click", /*click_handler_1*/ ctx[11], false, false, false),
    					listen_dev(div5, "click", /*click_handler_2*/ ctx[12], false, false, false),
    					listen_dev(div7, "click", /*click_handler_3*/ ctx[13], false, false, false),
    					listen_dev(div9, "click", /*click_handler_4*/ ctx[14], false, false, false),
    					listen_dev(div11, "click", /*click_handler_5*/ ctx[15], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*checkmark*/ 8) {
    				set_style(div1, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}

    			if (dirty & /*checkmark*/ 8) {
    				set_style(div3, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}

    			if (dirty & /*checkmark*/ 8) {
    				set_style(div5, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}

    			if (dirty & /*checkmark*/ 8) {
    				set_style(div7, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}

    			if (dirty & /*checkmark*/ 8) {
    				set_style(div9, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}

    			if (dirty & /*checkmark*/ 8) {
    				set_style(div11, "background", "url(" + /*checkmark*/ ctx[3] + ")");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div7);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div9);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div11);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(130:6) {#if modelTime >= 1.5}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let model_viewer;
    	let t;
    	let model_viewer_src_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*modelTime*/ ctx[4] >= 1.5 && create_if_block(ctx);
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			model_viewer = element("model-viewer");
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    			set_custom_element_data(model_viewer, "id", "unit01");
    			if (model_viewer.src !== (model_viewer_src_value = /*model*/ ctx[0])) set_custom_element_data(model_viewer, "src", model_viewer_src_value);
    			set_custom_element_data(model_viewer, "class", "model svelte-elcw9b");
    			set_custom_element_data(model_viewer, "environment-image", /*lights*/ ctx[1]);
    			set_custom_element_data(model_viewer, "shadow-color", "#ff0066");
    			set_custom_element_data(model_viewer, "camera-orbit", "330deg 78deg 130m");
    			set_custom_element_data(model_viewer, "alt", "Evo Laptop");
    			set_custom_element_data(model_viewer, "loading", "lazy");
    			set_custom_element_data(model_viewer, "exposure", "0.9");
    			set_custom_element_data(model_viewer, "auto-rotate", "true");
    			set_custom_element_data(model_viewer, "camera-controls", "");
    			set_custom_element_data(model_viewer, "autoplay", "true");
    			set_custom_element_data(model_viewer, "modelisvisible", "");
    			set_custom_element_data(model_viewer, "field-of-view", "90deg");
    			set_custom_element_data(model_viewer, "min-field-of-view", "auto");
    			set_custom_element_data(model_viewer, "max-field-of-view", "auto");
    			set_custom_element_data(model_viewer, "interaction-prompt", "none");
    			set_custom_element_data(model_viewer, "auto-rotate-delay", "1000");
    			set_custom_element_data(model_viewer, "camera-target", "0m 30m 0m");
    			set_custom_element_data(model_viewer, "rotation-per-second", "20%");
    			set_custom_element_data(model_viewer, "animation-name", "Running");
    			set_style(model_viewer, "background", "url(" + /*background*/ ctx[2] + ")");
    			add_location(model_viewer, file$4, 105, 4, 2098);
    			attr_dev(div0, "class", "ModeViewerHolder svelte-elcw9b");
    			add_location(div0, file$4, 104, 2, 2063);
    			attr_dev(div1, "id", "pageWrapper");
    			attr_dev(div1, "class", "svelte-elcw9b");
    			add_location(div1, file$4, 103, 0, 2038);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, model_viewer);
    			if (if_block) if_block.m(model_viewer, null);
    			append_dev(model_viewer, t);

    			if (default_slot) {
    				default_slot.m(model_viewer, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(model_viewer, "model-visibility", /*onLoad*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*modelTime*/ ctx[4] >= 1.5) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(model_viewer, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 256) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[8], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*model*/ 1 && model_viewer.src !== (model_viewer_src_value = /*model*/ ctx[0])) {
    				set_custom_element_data(model_viewer, "src", model_viewer_src_value);
    			}

    			if (!current || dirty & /*lights*/ 2) {
    				set_custom_element_data(model_viewer, "environment-image", /*lights*/ ctx[1]);
    			}

    			if (!current || dirty & /*background*/ 4) {
    				set_style(model_viewer, "background", "url(" + /*background*/ ctx[2] + ")");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("_3DModel", slots, ['default']);
    	let { modelViewer = "" } = $$props;
    	let { model = "" } = $$props;
    	let { lights = "" } = $$props;
    	let { background = "" } = $$props;
    	let { checkmark = "" } = $$props;
    	let modelTime = 0;
    	const dispatch = createEventDispatcher();

    	onMount(() => {
    		
    	}); //console.log("the component has mounted");

    	function onLoad() {
    		dispatch("model-visible", true);
    	}

    	function openDescription(key) {
    		dispatch("open-description", key);
    	}

    	(() => {
    		let interval = self.setInterval(
    			() => {
    				$$invalidate(4, modelTime = modelViewer.currentTime);

    				if (modelViewer.animationName === "Running" && modelViewer.currentTime >= 2) {
    					modelViewer.pause();
    					clearInterval(interval);
    				}
    			},
    			100
    		);
    	})();

    	const writable_props = ["modelViewer", "model", "lights", "background", "checkmark"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<_3DModel> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => openDescription(0);
    	const click_handler_1 = () => openDescription(1);
    	const click_handler_2 = () => openDescription(2);
    	const click_handler_3 = () => openDescription(3);
    	const click_handler_4 = () => openDescription(4);
    	const click_handler_5 = () => openDescription(5);

    	$$self.$$set = $$props => {
    		if ("modelViewer" in $$props) $$invalidate(7, modelViewer = $$props.modelViewer);
    		if ("model" in $$props) $$invalidate(0, model = $$props.model);
    		if ("lights" in $$props) $$invalidate(1, lights = $$props.lights);
    		if ("background" in $$props) $$invalidate(2, background = $$props.background);
    		if ("checkmark" in $$props) $$invalidate(3, checkmark = $$props.checkmark);
    		if ("$$scope" in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		modelViewer,
    		model,
    		lights,
    		background,
    		checkmark,
    		modelTime,
    		dispatch,
    		onLoad,
    		openDescription
    	});

    	$$self.$inject_state = $$props => {
    		if ("modelViewer" in $$props) $$invalidate(7, modelViewer = $$props.modelViewer);
    		if ("model" in $$props) $$invalidate(0, model = $$props.model);
    		if ("lights" in $$props) $$invalidate(1, lights = $$props.lights);
    		if ("background" in $$props) $$invalidate(2, background = $$props.background);
    		if ("checkmark" in $$props) $$invalidate(3, checkmark = $$props.checkmark);
    		if ("modelTime" in $$props) $$invalidate(4, modelTime = $$props.modelTime);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		model,
    		lights,
    		background,
    		checkmark,
    		modelTime,
    		onLoad,
    		openDescription,
    		modelViewer,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class _3DModel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
    			modelViewer: 7,
    			model: 0,
    			lights: 1,
    			background: 2,
    			checkmark: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "_3DModel",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get modelViewer() {
    		throw new Error("<_3DModel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set modelViewer(value) {
    		throw new Error("<_3DModel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get model() {
    		throw new Error("<_3DModel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set model(value) {
    		throw new Error("<_3DModel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lights() {
    		throw new Error("<_3DModel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lights(value) {
    		throw new Error("<_3DModel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get background() {
    		throw new Error("<_3DModel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set background(value) {
    		throw new Error("<_3DModel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checkmark() {
    		throw new Error("<_3DModel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checkmark(value) {
    		throw new Error("<_3DModel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/VideoPlayer.svelte generated by Svelte v3.29.0 */
    const file$5 = "src/components/custom/VideoPlayer.svelte";

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let video_js;
    	let t1;
    	let script;
    	let script_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			video_js = element("video-js");
    			t1 = space();
    			script = element("script");
    			attr_dev(img, "class", "img");
    			if (img.src !== (img_src_value = /*exitButton*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "exit");
    			add_location(img, file$5, 33, 4, 639);
    			attr_dev(div0, "class", "exit close-video svelte-1u42b8b");
    			add_location(div0, file$5, 32, 2, 588);
    			set_custom_element_data(video_js, "autoplay", "");
    			set_custom_element_data(video_js, "data-account", /*dataAccount*/ ctx[0]);
    			set_custom_element_data(video_js, "data-player", "default");
    			set_custom_element_data(video_js, "data-embed", "default");
    			set_custom_element_data(video_js, "controls", "");
    			set_custom_element_data(video_js, "data-video-id", /*videoId*/ ctx[1]);
    			set_custom_element_data(video_js, "data-playlist-id", "");
    			set_custom_element_data(video_js, "data-application-id", "");
    			set_custom_element_data(video_js, "class", "vjs-fluid");
    			add_location(video_js, file$5, 35, 2, 698);
    			if (script.src !== (script_src_value = "https://players.brightcove.net/5226411160001/default_default/index.min.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$5, 45, 2, 925);
    			attr_dev(div1, "class", "video svelte-1u42b8b");
    			add_location(div1, file$5, 31, 0, 566);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div1, t0);
    			append_dev(div1, video_js);
    			append_dev(div1, t1);
    			append_dev(div1, script);

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*exit*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*exitButton*/ 4 && img.src !== (img_src_value = /*exitButton*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*dataAccount*/ 1) {
    				set_custom_element_data(video_js, "data-account", /*dataAccount*/ ctx[0]);
    			}

    			if (dirty & /*videoId*/ 2) {
    				set_custom_element_data(video_js, "data-video-id", /*videoId*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("VideoPlayer", slots, []);
    	let { dataAccount } = $$props;
    	let { videoId } = $$props;
    	let { exitButton } = $$props;
    	const dispatch = createEventDispatcher();

    	function exit() {
    		dispatch("close-description", false);
    	}

    	const writable_props = ["dataAccount", "videoId", "exitButton"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<VideoPlayer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("dataAccount" in $$props) $$invalidate(0, dataAccount = $$props.dataAccount);
    		if ("videoId" in $$props) $$invalidate(1, videoId = $$props.videoId);
    		if ("exitButton" in $$props) $$invalidate(2, exitButton = $$props.exitButton);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dataAccount,
    		videoId,
    		exitButton,
    		dispatch,
    		exit
    	});

    	$$self.$inject_state = $$props => {
    		if ("dataAccount" in $$props) $$invalidate(0, dataAccount = $$props.dataAccount);
    		if ("videoId" in $$props) $$invalidate(1, videoId = $$props.videoId);
    		if ("exitButton" in $$props) $$invalidate(2, exitButton = $$props.exitButton);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [dataAccount, videoId, exitButton, exit];
    }

    class VideoPlayer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			dataAccount: 0,
    			videoId: 1,
    			exitButton: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VideoPlayer",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*dataAccount*/ ctx[0] === undefined && !("dataAccount" in props)) {
    			console.warn("<VideoPlayer> was created without expected prop 'dataAccount'");
    		}

    		if (/*videoId*/ ctx[1] === undefined && !("videoId" in props)) {
    			console.warn("<VideoPlayer> was created without expected prop 'videoId'");
    		}

    		if (/*exitButton*/ ctx[2] === undefined && !("exitButton" in props)) {
    			console.warn("<VideoPlayer> was created without expected prop 'exitButton'");
    		}
    	}

    	get dataAccount() {
    		throw new Error("<VideoPlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataAccount(value) {
    		throw new Error("<VideoPlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get videoId() {
    		throw new Error("<VideoPlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set videoId(value) {
    		throw new Error("<VideoPlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exitButton() {
    		throw new Error("<VideoPlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exitButton(value) {
    		throw new Error("<VideoPlayer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/FeaturesDescription.svelte generated by Svelte v3.29.0 */
    const file$6 = "src/components/FeaturesDescription.svelte";

    // (98:6) {#if displayVideo}
    function create_if_block$1(ctx) {
    	let videoplayer;
    	let current;

    	videoplayer = new VideoPlayer({
    			props: {
    				dataAccount: /*videoAccount*/ ctx[2],
    				videoId: /*videoId*/ ctx[3],
    				exitButton: /*exitButton*/ ctx[5]
    			},
    			$$inline: true
    		});

    	videoplayer.$on("close-description", /*exit*/ ctx[7]);

    	const block = {
    		c: function create() {
    			create_component(videoplayer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(videoplayer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const videoplayer_changes = {};
    			if (dirty & /*videoAccount*/ 4) videoplayer_changes.dataAccount = /*videoAccount*/ ctx[2];
    			if (dirty & /*videoId*/ 8) videoplayer_changes.videoId = /*videoId*/ ctx[3];
    			if (dirty & /*exitButton*/ 32) videoplayer_changes.exitButton = /*exitButton*/ ctx[5];
    			videoplayer.$set(videoplayer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(videoplayer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(videoplayer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(videoplayer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(98:6) {#if displayVideo}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div6;
    	let div5;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div1;
    	let p0;
    	let t1;
    	let p1;
    	let t2;
    	let div3;
    	let div2;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let t4;
    	let div4;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*displayVideo*/ ctx[6] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div1 = element("div");
    			p0 = element("p");
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			img1 = element("img");
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			div4 = element("div");
    			attr_dev(img0, "class", "img");
    			if (img0.src !== (img0_src_value = /*exitButton*/ ctx[5])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "exit");
    			add_location(img0, file$6, 83, 6, 2005);
    			attr_dev(div0, "class", "exit svelte-1qohe7m");
    			add_location(div0, file$6, 82, 4, 1964);
    			attr_dev(p0, "class", "title svelte-1qohe7m");
    			add_location(p0, file$6, 86, 6, 2095);
    			attr_dev(p1, "class", "subtitle svelte-1qohe7m");
    			add_location(p1, file$6, 89, 6, 2152);
    			attr_dev(div1, "class", "header svelte-1qohe7m");
    			add_location(div1, file$6, 85, 4, 2068);
    			attr_dev(img1, "class", "img");
    			if (img1.src !== (img1_src_value = /*thumbnail*/ ctx[4])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "video");
    			add_location(img1, file$6, 95, 8, 2313);
    			attr_dev(div2, "class", "thumbnail svelte-1qohe7m");
    			add_location(div2, file$6, 94, 6, 2260);
    			attr_dev(div3, "class", "video-container svelte-1qohe7m");
    			add_location(div3, file$6, 93, 4, 2224);
    			attr_dev(div4, "class", "layer svelte-1qohe7m");
    			add_location(div4, file$6, 105, 4, 2568);
    			attr_dev(div5, "class", "body svelte-1qohe7m");
    			add_location(div5, file$6, 81, 2, 1941);
    			attr_dev(div6, "class", "feature-description svelte-1qohe7m");
    			add_location(div6, file$6, 80, 0, 1905);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div0, img0);
    			append_dev(div5, t0);
    			append_dev(div5, div1);
    			append_dev(div1, p0);
    			p0.innerHTML = /*title*/ ctx[0];
    			append_dev(div1, t1);
    			append_dev(div1, p1);
    			p1.innerHTML = /*subtitle*/ ctx[1];
    			append_dev(div5, t2);
    			append_dev(div5, div3);
    			append_dev(div3, div2);
    			append_dev(div2, img1);
    			append_dev(div3, t3);
    			if (if_block) if_block.m(div3, null);
    			append_dev(div5, t4);
    			append_dev(div5, div4);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*exit*/ ctx[7], false, false, false),
    					listen_dev(div2, "click", /*openVideo*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*exitButton*/ 32 && img0.src !== (img0_src_value = /*exitButton*/ ctx[5])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (!current || dirty & /*title*/ 1) p0.innerHTML = /*title*/ ctx[0];			if (!current || dirty & /*subtitle*/ 2) p1.innerHTML = /*subtitle*/ ctx[1];
    			if (!current || dirty & /*thumbnail*/ 16 && img1.src !== (img1_src_value = /*thumbnail*/ ctx[4])) {
    				attr_dev(img1, "src", img1_src_value);
    			}

    			if (/*displayVideo*/ ctx[6]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*displayVideo*/ 64) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (detaching) detach_dev(div6);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("FeaturesDescription", slots, []);
    	let { title = "" } = $$props;
    	let { subtitle = "" } = $$props;
    	let { videoAccount = "" } = $$props;
    	let { videoId = "" } = $$props;
    	let { model = "" } = $$props;
    	let { thumbnail = "" } = $$props;
    	let { exitButton = "" } = $$props;
    	let displayVideo = false;
    	const dispatch = createEventDispatcher();

    	function exit() {
    		resetModel();
    		$$invalidate(9, model.autoRotate = true, model);
    		dispatch("close-description", false);
    	}

    	function resetModel() {
    		$$invalidate(9, model.cameraOrbit = "33.36deg 85.73deg 120m", model);
    	}

    	function openVideo() {
    		$$invalidate(6, displayVideo = true);
    	}

    	const writable_props = [
    		"title",
    		"subtitle",
    		"videoAccount",
    		"videoId",
    		"model",
    		"thumbnail",
    		"exitButton"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FeaturesDescription> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ("videoAccount" in $$props) $$invalidate(2, videoAccount = $$props.videoAccount);
    		if ("videoId" in $$props) $$invalidate(3, videoId = $$props.videoId);
    		if ("model" in $$props) $$invalidate(9, model = $$props.model);
    		if ("thumbnail" in $$props) $$invalidate(4, thumbnail = $$props.thumbnail);
    		if ("exitButton" in $$props) $$invalidate(5, exitButton = $$props.exitButton);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		VideoPlayer,
    		title,
    		subtitle,
    		videoAccount,
    		videoId,
    		model,
    		thumbnail,
    		exitButton,
    		displayVideo,
    		dispatch,
    		exit,
    		resetModel,
    		openVideo
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ("videoAccount" in $$props) $$invalidate(2, videoAccount = $$props.videoAccount);
    		if ("videoId" in $$props) $$invalidate(3, videoId = $$props.videoId);
    		if ("model" in $$props) $$invalidate(9, model = $$props.model);
    		if ("thumbnail" in $$props) $$invalidate(4, thumbnail = $$props.thumbnail);
    		if ("exitButton" in $$props) $$invalidate(5, exitButton = $$props.exitButton);
    		if ("displayVideo" in $$props) $$invalidate(6, displayVideo = $$props.displayVideo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		title,
    		subtitle,
    		videoAccount,
    		videoId,
    		thumbnail,
    		exitButton,
    		displayVideo,
    		exit,
    		openVideo,
    		model
    	];
    }

    class FeaturesDescription extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			title: 0,
    			subtitle: 1,
    			videoAccount: 2,
    			videoId: 3,
    			model: 9,
    			thumbnail: 4,
    			exitButton: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FeaturesDescription",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get title() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subtitle() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subtitle(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get videoAccount() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set videoAccount(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get videoId() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set videoId(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get model() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set model(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get thumbnail() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set thumbnail(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exitButton() {
    		throw new Error("<FeaturesDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exitButton(value) {
    		throw new Error("<FeaturesDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/LoadingScreen.svelte generated by Svelte v3.29.0 */

    const file$7 = "src/components/custom/LoadingScreen.svelte";

    function create_fragment$7(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "loader-animation svelte-k6zrnn");
    			set_style(div0, "background", "url(" + /*loader*/ ctx[0] + ")");
    			add_location(div0, file$7, 25, 2, 422);
    			attr_dev(div1, "class", "loader svelte-k6zrnn");
    			add_location(div1, file$7, 24, 0, 399);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*loader*/ 1) {
    				set_style(div0, "background", "url(" + /*loader*/ ctx[0] + ")");
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("LoadingScreen", slots, []);
    	let { loader } = $$props;
    	const writable_props = ["loader"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<LoadingScreen> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("loader" in $$props) $$invalidate(0, loader = $$props.loader);
    	};

    	$$self.$capture_state = () => ({ loader });

    	$$self.$inject_state = $$props => {
    		if ("loader" in $$props) $$invalidate(0, loader = $$props.loader);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [loader];
    }

    class LoadingScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { loader: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LoadingScreen",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*loader*/ ctx[0] === undefined && !("loader" in props)) {
    			console.warn("<LoadingScreen> was created without expected prop 'loader'");
    		}
    	}

    	get loader() {
    		throw new Error("<LoadingScreen>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set loader(value) {
    		throw new Error("<LoadingScreen>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/BlurryScreen.svelte generated by Svelte v3.29.0 */

    const file$8 = "src/components/custom/BlurryScreen.svelte";

    function create_fragment$8(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "blurry-screen svelte-1ccu23b");
    			add_location(div, file$8, 13, 0, 236);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("BlurryScreen", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<BlurryScreen> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class BlurryScreen extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "BlurryScreen",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/Legal.svelte generated by Svelte v3.29.0 */
    const file$9 = "src/components/Legal.svelte";

    function create_fragment$9(ctx) {
    	let div4;
    	let div3;
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let t;
    	let div2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t = space();
    			div2 = element("div");
    			attr_dev(img, "class", "img");
    			if (img.src !== (img_src_value = /*exitButton*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "exit");
    			add_location(img, file$9, 48, 10, 1111);
    			attr_dev(div0, "class", "exit svelte-1jr3v4w");
    			add_location(div0, file$9, 47, 8, 1060);
    			attr_dev(div1, "class", "close-container svelte-1jr3v4w");
    			add_location(div1, file$9, 46, 6, 1022);
    			attr_dev(div2, "class", "text-container svelte-1jr3v4w");
    			add_location(div2, file$9, 51, 6, 1193);
    			attr_dev(div3, "class", "legal svelte-1jr3v4w");
    			add_location(div3, file$9, 45, 4, 996);
    			attr_dev(div4, "class", "legal-container svelte-1jr3v4w");
    			add_location(div4, file$9, 44, 2, 962);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div3, t);
    			append_dev(div3, div2);
    			div2.innerHTML = /*copy*/ ctx[0];

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*closeLegal*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*exitButton*/ 2 && img.src !== (img_src_value = /*exitButton*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*copy*/ 1) div2.innerHTML = /*copy*/ ctx[0];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Legal", slots, []);
    	let { copy } = $$props;
    	let { exitButton } = $$props;
    	const dispatch = createEventDispatcher();

    	function closeLegal() {
    		dispatch("close-modal", false);
    	}

    	const writable_props = ["copy", "exitButton"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Legal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("exitButton" in $$props) $$invalidate(1, exitButton = $$props.exitButton);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		copy,
    		exitButton,
    		dispatch,
    		closeLegal
    	});

    	$$self.$inject_state = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("exitButton" in $$props) $$invalidate(1, exitButton = $$props.exitButton);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [copy, exitButton, closeLegal];
    }

    class Legal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { copy: 0, exitButton: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Legal",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*copy*/ ctx[0] === undefined && !("copy" in props)) {
    			console.warn("<Legal> was created without expected prop 'copy'");
    		}

    		if (/*exitButton*/ ctx[1] === undefined && !("exitButton" in props)) {
    			console.warn("<Legal> was created without expected prop 'exitButton'");
    		}
    	}

    	get copy() {
    		throw new Error("<Legal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set copy(value) {
    		throw new Error("<Legal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exitButton() {
    		throw new Error("<Legal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exitButton(value) {
    		throw new Error("<Legal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/ZoomGlass.svelte generated by Svelte v3.29.0 */
    const file$a = "src/components/custom/ZoomGlass.svelte";

    function create_fragment$a(ctx) {
    	let scipt;
    	let t0;
    	let div2;
    	let div1;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;

    	const block = {
    		c: function create() {
    			scipt = element("scipt");
    			t0 = space();
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			add_location(scipt, file$a, 79, 0, 1611);
    			attr_dev(img0, "id", "EV_Inmersive");
    			if (img0.src !== (img0_src_value = /*zoomifyGlassFront*/ ctx[0])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "EV_Inmersive");
    			attr_dev(img0, "class", "svelte-ohwwqy");
    			add_location(img0, file$a, 86, 6, 1790);
    			attr_dev(div0, "id", "InmersiveContainer");
    			attr_dev(div0, "class", "svelte-ohwwqy");
    			add_location(div0, file$a, 85, 4, 1754);
    			attr_dev(img1, "id", "EV_lens");
    			if (img1.src !== (img1_src_value = /*zoomifyGlass*/ ctx[1])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "EV_lens");
    			attr_dev(img1, "class", "svelte-ohwwqy");
    			add_location(img1, file$a, 88, 4, 1874);
    			attr_dev(div1, "id", "glassContainer");
    			attr_dev(div1, "class", "svelte-ohwwqy");
    			add_location(div1, file$a, 84, 2, 1724);
    			attr_dev(div2, "id", "animZoom");
    			attr_dev(div2, "class", "noMouseInteraction overlaysFXs svelte-ohwwqy");
    			attr_dev(div2, "data-visibility-attribute", "visible");
    			add_location(div2, file$a, 80, 0, 1621);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, scipt, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img0);
    			append_dev(div1, t1);
    			append_dev(div1, img1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*zoomifyGlassFront*/ 1 && img0.src !== (img0_src_value = /*zoomifyGlassFront*/ ctx[0])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (dirty & /*zoomifyGlass*/ 2 && img1.src !== (img1_src_value = /*zoomifyGlass*/ ctx[1])) {
    				attr_dev(img1, "src", img1_src_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(scipt);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function animationZoomifyGlass() {
    	let zoomScreenTL = new TimelineMax();

    	zoomScreenTL.add("reset").from(
    		glassContainer,
    		0.3,
    		{
    			opacity: 0,
    			scaleX: 0,
    			scaleY: 0,
    			y: "120"
    		},
    		0.3
    	).to(glassContainer, 0.3, { scaleX: 1.2, scaleY: 1.2 }, 0.3).to(glassContainer, 0.3, { opacity: 1, scaleX: 1, scaleY: 1, y: "0" }, 0.4).add("slide").to(glassContainer, 3, { x: "-50" }, "slide").to(EV_Inmersive, 3, { x: "50" }, "slide");
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ZoomGlass", slots, []);
    	let { zoomifyGlassFront } = $$props;
    	let { zoomifyGlass } = $$props;

    	onMount(() => {
    		animationZoomifyGlass();
    	});

    	const writable_props = ["zoomifyGlassFront", "zoomifyGlass"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ZoomGlass> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("zoomifyGlassFront" in $$props) $$invalidate(0, zoomifyGlassFront = $$props.zoomifyGlassFront);
    		if ("zoomifyGlass" in $$props) $$invalidate(1, zoomifyGlass = $$props.zoomifyGlass);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		zoomifyGlassFront,
    		zoomifyGlass,
    		animationZoomifyGlass
    	});

    	$$self.$inject_state = $$props => {
    		if ("zoomifyGlassFront" in $$props) $$invalidate(0, zoomifyGlassFront = $$props.zoomifyGlassFront);
    		if ("zoomifyGlass" in $$props) $$invalidate(1, zoomifyGlass = $$props.zoomifyGlass);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [zoomifyGlassFront, zoomifyGlass];
    }

    class ZoomGlass extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { zoomifyGlassFront: 0, zoomifyGlass: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ZoomGlass",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*zoomifyGlassFront*/ ctx[0] === undefined && !("zoomifyGlassFront" in props)) {
    			console.warn("<ZoomGlass> was created without expected prop 'zoomifyGlassFront'");
    		}

    		if (/*zoomifyGlass*/ ctx[1] === undefined && !("zoomifyGlass" in props)) {
    			console.warn("<ZoomGlass> was created without expected prop 'zoomifyGlass'");
    		}
    	}

    	get zoomifyGlassFront() {
    		throw new Error("<ZoomGlass>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set zoomifyGlassFront(value) {
    		throw new Error("<ZoomGlass>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get zoomifyGlass() {
    		throw new Error("<ZoomGlass>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set zoomifyGlass(value) {
    		throw new Error("<ZoomGlass>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.0 */

    const { console: console_1, document: document_1 } = globals;
    const file$b = "src/App.svelte";

    // (184:2) {#if !isModelVisible}
    function create_if_block_5(ctx) {
    	let loadingscreen;
    	let current;

    	loadingscreen = new LoadingScreen({
    			props: { loader: /*content*/ ctx[0].assets.loader },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(loadingscreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(loadingscreen, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const loadingscreen_changes = {};
    			if (dirty & /*content*/ 1) loadingscreen_changes.loader = /*content*/ ctx[0].assets.loader;
    			loadingscreen.$set(loadingscreen_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loadingscreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loadingscreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(loadingscreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(184:2) {#if !isModelVisible}",
    		ctx
    	});

    	return block;
    }

    // (187:2) {#if showBlurryScreen}
    function create_if_block_4(ctx) {
    	let blurryscreen;
    	let current;
    	blurryscreen = new BlurryScreen({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(blurryscreen.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blurryscreen, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blurryscreen.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blurryscreen.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blurryscreen, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(187:2) {#if showBlurryScreen}",
    		ctx
    	});

    	return block;
    }

    // (190:2) {#if showLegal}
    function create_if_block_3(ctx) {
    	let legal;
    	let current;

    	legal = new Legal({
    			props: {
    				exitButton: /*content*/ ctx[0].assets.exit_button,
    				copy: /*content*/ ctx[0].footer.legal.description
    			},
    			$$inline: true
    		});

    	legal.$on("close-modal", /*closeModalHandler*/ ctx[13]);

    	const block = {
    		c: function create() {
    			create_component(legal.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(legal, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const legal_changes = {};
    			if (dirty & /*content*/ 1) legal_changes.exitButton = /*content*/ ctx[0].assets.exit_button;
    			if (dirty & /*content*/ 1) legal_changes.copy = /*content*/ ctx[0].footer.legal.description;
    			legal.$set(legal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(legal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(legal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(legal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(190:2) {#if showLegal}",
    		ctx
    	});

    	return block;
    }

    // (209:6) {#if showAnimation}
    function create_if_block_2(ctx) {
    	let zoomglass;
    	let current;

    	zoomglass = new ZoomGlass({
    			props: {
    				zoomifyGlassFront: /*content*/ ctx[0].assets.zoomify_glassFront,
    				zoomifyGlass: /*content*/ ctx[0].assets.zoomify_glass
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(zoomglass.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(zoomglass, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const zoomglass_changes = {};
    			if (dirty & /*content*/ 1) zoomglass_changes.zoomifyGlassFront = /*content*/ ctx[0].assets.zoomify_glassFront;
    			if (dirty & /*content*/ 1) zoomglass_changes.zoomifyGlass = /*content*/ ctx[0].assets.zoomify_glass;
    			zoomglass.$set(zoomglass_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(zoomglass.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(zoomglass.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(zoomglass, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(209:6) {#if showAnimation}",
    		ctx
    	});

    	return block;
    }

    // (201:4) <Model       {modelViewer}       model={content.assets.model}       lights={content.assets.lights}       background={content.assets.background}       checkmark={content.assets.checkmark}       on:model-visible={isVisible}       on:open-description={openDescription}>
    function create_default_slot(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*showAnimation*/ ctx[8] && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*showAnimation*/ ctx[8]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showAnimation*/ 256) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
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
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(201:4) <Model       {modelViewer}       model={content.assets.model}       lights={content.assets.lights}       background={content.assets.background}       checkmark={content.assets.checkmark}       on:model-visible={isVisible}       on:open-description={openDescription}>",
    		ctx
    	});

    	return block;
    }

    // (215:4) {#if isModelVisible}
    function create_if_block$2(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*optionClicked*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "features-container svelte-6opkfp");
    			add_location(div, file$b, 215, 6, 5951);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
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
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(215:4) {#if isModelVisible}",
    		ctx
    	});

    	return block;
    }

    // (223:8) {:else}
    function create_else_block(ctx) {
    	let featuresdescription;
    	let current;

    	featuresdescription = new FeaturesDescription({
    			props: {
    				title: /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].copy,
    				subtitle: /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].description,
    				videoAccount: /*videos*/ ctx[1][/*featureId*/ ctx[3]].data_account,
    				videoId: /*videos*/ ctx[1][/*featureId*/ ctx[3]].video_id,
    				thumbnail: /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].url.thumbnail,
    				exitButton: /*content*/ ctx[0].assets.exit_button,
    				model: /*modelViewer*/ ctx[4]
    			},
    			$$inline: true
    		});

    	featuresdescription.$on("close-description", /*closeDescription*/ ctx[11]);

    	const block = {
    		c: function create() {
    			create_component(featuresdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(featuresdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const featuresdescription_changes = {};
    			if (dirty & /*content, featureId*/ 9) featuresdescription_changes.title = /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].copy;
    			if (dirty & /*content, featureId*/ 9) featuresdescription_changes.subtitle = /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].description;
    			if (dirty & /*videos, featureId*/ 10) featuresdescription_changes.videoAccount = /*videos*/ ctx[1][/*featureId*/ ctx[3]].data_account;
    			if (dirty & /*videos, featureId*/ 10) featuresdescription_changes.videoId = /*videos*/ ctx[1][/*featureId*/ ctx[3]].video_id;
    			if (dirty & /*content, featureId*/ 9) featuresdescription_changes.thumbnail = /*content*/ ctx[0].hotspots[/*featureId*/ ctx[3]].url.thumbnail;
    			if (dirty & /*content*/ 1) featuresdescription_changes.exitButton = /*content*/ ctx[0].assets.exit_button;
    			if (dirty & /*modelViewer*/ 16) featuresdescription_changes.model = /*modelViewer*/ ctx[4];
    			featuresdescription.$set(featuresdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(featuresdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(featuresdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(featuresdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(223:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (217:8) {#if !optionClicked}
    function create_if_block_1(ctx) {
    	let featureslist;
    	let current;

    	featureslist = new FeaturesList({
    			props: {
    				features: /*content*/ ctx[0].hotspots,
    				listCheckmark: /*content*/ ctx[0].assets.list_checkmark,
    				rightArrow: /*content*/ ctx[0].assets.right_arrow
    			},
    			$$inline: true
    		});

    	featureslist.$on("open-description", /*openDescription*/ ctx[10]);

    	const block = {
    		c: function create() {
    			create_component(featureslist.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(featureslist, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const featureslist_changes = {};
    			if (dirty & /*content*/ 1) featureslist_changes.features = /*content*/ ctx[0].hotspots;
    			if (dirty & /*content*/ 1) featureslist_changes.listCheckmark = /*content*/ ctx[0].assets.list_checkmark;
    			if (dirty & /*content*/ 1) featureslist_changes.rightArrow = /*content*/ ctx[0].assets.right_arrow;
    			featureslist.$set(featureslist_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(featureslist.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(featureslist.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(featureslist, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(217:8) {#if !optionClicked}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let script0;
    	let script0_src_value;
    	let script1;
    	let script1_src_value;
    	let script2;
    	let script2_src_value;
    	let script3;
    	let script3_src_value;
    	let t0;
    	let div1;
    	let t1;
    	let t2;
    	let t3;
    	let header;
    	let t4;
    	let div0;
    	let model;
    	let t5;
    	let t6;
    	let footer;
    	let current;
    	let if_block0 = !/*isModelVisible*/ ctx[5] && create_if_block_5(ctx);
    	let if_block1 = /*showBlurryScreen*/ ctx[7] && create_if_block_4(ctx);
    	let if_block2 = /*showLegal*/ ctx[6] && create_if_block_3(ctx);

    	header = new Header({
    			props: {
    				headline: /*content*/ ctx[0].header.headline,
    				subheadline: /*content*/ ctx[0].header.subheadline_mobile,
    				arrow: /*content*/ ctx[0].assets.down_arrow
    			},
    			$$inline: true
    		});

    	model = new _3DModel({
    			props: {
    				modelViewer: /*modelViewer*/ ctx[4],
    				model: /*content*/ ctx[0].assets.model,
    				lights: /*content*/ ctx[0].assets.lights,
    				background: /*content*/ ctx[0].assets.background,
    				checkmark: /*content*/ ctx[0].assets.checkmark,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	model.$on("model-visible", /*isVisible*/ ctx[9]);
    	model.$on("open-description", /*openDescription*/ ctx[10]);
    	let if_block3 = /*isModelVisible*/ ctx[5] && create_if_block$2(ctx);

    	footer = new Footer({
    			props: {
    				copy: /*content*/ ctx[0].footer,
    				logo: /*content*/ ctx[0].assets.evo_checkmark,
    				closeDevice: /*content*/ ctx[0].assets.close_device,
    				openDevice: /*content*/ ctx[0].assets.open_device
    			},
    			$$inline: true
    		});

    	footer.$on("open-modal", /*openModalHandler*/ ctx[12]);

    	const block = {
    		c: function create() {
    			script0 = element("script");
    			script1 = element("script");
    			script2 = element("script");
    			script3 = element("script");
    			t0 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			if (if_block2) if_block2.c();
    			t3 = space();
    			create_component(header.$$.fragment);
    			t4 = space();
    			div0 = element("div");
    			create_component(model.$$.fragment);
    			t5 = space();
    			if (if_block3) if_block3.c();
    			t6 = space();
    			create_component(footer.$$.fragment);
    			if (script0.src !== (script0_src_value = "https://unpkg.com/@webcomponents/webcomponentsjs@2.1.3/webcomponents-loader.js")) attr_dev(script0, "src", script0_src_value);
    			add_location(script0, file$b, 169, 2, 4482);
    			if (script1.src !== (script1_src_value = "https://unpkg.com/intersection-observer@0.5.1/intersection-observer.js")) attr_dev(script1, "src", script1_src_value);
    			add_location(script1, file$b, 172, 2, 4594);
    			if (script2.src !== (script2_src_value = "https://unpkg.com/resize-observer-polyfill@1.5.1/dist/ResizeObserver.js")) attr_dev(script2, "src", script2_src_value);
    			add_location(script2, file$b, 175, 2, 4698);
    			if (script3.src !== (script3_src_value = "https://unpkg.com/focus-visible@5.1.0/dist/focus-visible.js")) attr_dev(script3, "src", script3_src_value);
    			add_location(script3, file$b, 178, 2, 4803);
    			attr_dev(div0, "class", "content-container svelte-6opkfp");
    			add_location(div0, file$b, 199, 2, 5426);
    			attr_dev(div1, "class", "main-container svelte-6opkfp");
    			add_location(div1, file$b, 182, 0, 4941);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document_1.head, script0);
    			append_dev(document_1.head, script1);
    			append_dev(document_1.head, script2);
    			append_dev(document_1.head, script3);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t1);
    			if (if_block1) if_block1.m(div1, null);
    			append_dev(div1, t2);
    			if (if_block2) if_block2.m(div1, null);
    			append_dev(div1, t3);
    			mount_component(header, div1, null);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			mount_component(model, div0, null);
    			append_dev(div0, t5);
    			if (if_block3) if_block3.m(div0, null);
    			append_dev(div1, t6);
    			mount_component(footer, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isModelVisible*/ ctx[5]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*isModelVisible*/ 32) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div1, t1);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*showBlurryScreen*/ ctx[7]) {
    				if (if_block1) {
    					if (dirty & /*showBlurryScreen*/ 128) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_4(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div1, t2);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*showLegal*/ ctx[6]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*showLegal*/ 64) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_3(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div1, t3);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			const header_changes = {};
    			if (dirty & /*content*/ 1) header_changes.headline = /*content*/ ctx[0].header.headline;
    			if (dirty & /*content*/ 1) header_changes.subheadline = /*content*/ ctx[0].header.subheadline_mobile;
    			if (dirty & /*content*/ 1) header_changes.arrow = /*content*/ ctx[0].assets.down_arrow;
    			header.$set(header_changes);
    			const model_changes = {};
    			if (dirty & /*modelViewer*/ 16) model_changes.modelViewer = /*modelViewer*/ ctx[4];
    			if (dirty & /*content*/ 1) model_changes.model = /*content*/ ctx[0].assets.model;
    			if (dirty & /*content*/ 1) model_changes.lights = /*content*/ ctx[0].assets.lights;
    			if (dirty & /*content*/ 1) model_changes.background = /*content*/ ctx[0].assets.background;
    			if (dirty & /*content*/ 1) model_changes.checkmark = /*content*/ ctx[0].assets.checkmark;

    			if (dirty & /*$$scope, content, showAnimation*/ 65793) {
    				model_changes.$$scope = { dirty, ctx };
    			}

    			model.$set(model_changes);

    			if (/*isModelVisible*/ ctx[5]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty & /*isModelVisible*/ 32) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block$2(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div0, null);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			const footer_changes = {};
    			if (dirty & /*content*/ 1) footer_changes.copy = /*content*/ ctx[0].footer;
    			if (dirty & /*content*/ 1) footer_changes.logo = /*content*/ ctx[0].assets.evo_checkmark;
    			if (dirty & /*content*/ 1) footer_changes.closeDevice = /*content*/ ctx[0].assets.close_device;
    			if (dirty & /*content*/ 1) footer_changes.openDevice = /*content*/ ctx[0].assets.open_device;
    			footer.$set(footer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(header.$$.fragment, local);
    			transition_in(model.$$.fragment, local);
    			transition_in(if_block3);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(header.$$.fragment, local);
    			transition_out(model.$$.fragment, local);
    			transition_out(if_block3);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(script0);
    			detach_dev(script1);
    			detach_dev(script2);
    			detach_dev(script3);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			destroy_component(header);
    			destroy_component(model);
    			if (if_block3) if_block3.d();
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function removeHotspots$1(id) {
    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		if (i != id) {
    			hotspots[i].removeAttribute("data-visible");
    		}
    	}
    }

    function showHotspots$1() {
    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		hotspots[i].setAttribute("data-visible", "");
    	}
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { content } = $$props;
    	let { videos } = $$props;
    	let optionClicked = false;
    	let featureId = -1;
    	let modelViewer = "";
    	let isModelVisible = false;
    	let showLegal = false;
    	let showBlurryScreen = false;
    	let showAnimation = false;

    	onMount(function () {
    		$$invalidate(4, modelViewer = document.getElementById("unit01"));
    	});

    	function isVisible() {
    		$$invalidate(5, isModelVisible = true);
    	}

    	afterUpdate(() => {
    		
    	});

    	function playRange(start, time) {
    		let animationPause;
    		modelViewer.play();
    		$$invalidate(4, modelViewer.currentTime = start, modelViewer);

    		animationPause = setTimeout(
    			function () {
    				modelViewer.pause();
    				open = false;
    			},
    			time
    		);
    	}

    	function openDescription(event) {
    		var closeBtn = document.getElementById("closeBtn");
    		closeBtn.style.opacity = 0.5;
    		closeBtn.style.pointerEvents = "none";
    		$$invalidate(3, featureId = event.detail);
    		$$invalidate(2, optionClicked = true);
    		let hotspot = document.getElementById("animation0" + (featureId + 1));
    		hotspot.classList.add("hotspot-selected");
    		$$invalidate(4, modelViewer.cameraControls = false, modelViewer);
    		clickHS(featureId);
    		removeHotspots$1(featureId);
    	}

    	function closeDescription(event) {
    		var closeBtn = document.getElementById("closeBtn");
    		closeBtn.style.opacity = 1;
    		closeBtn.style.pointerEvents = "";
    		let hotspot = document.getElementById("animation0" + (featureId + 1));
    		hotspot.classList.remove("hotspot-selected");
    		$$invalidate(3, featureId = -1);
    		$$invalidate(2, optionClicked = false);
    		$$invalidate(4, modelViewer.cameraControls = true, modelViewer);
    		$$invalidate(8, showAnimation = false);
    		playRange(2, 100);
    		showHotspots$1();
    	}

    	function openModalHandler(event) {
    		$$invalidate(6, showLegal = event.detail);
    		$$invalidate(7, showBlurryScreen = event.detail);
    	}

    	function closeModalHandler(event) {
    		$$invalidate(6, showLegal = event.detail);
    		$$invalidate(7, showBlurryScreen = event.detail);
    	}

    	function clickHS(el) {
    		let model = modelViewer;
    		$$invalidate(8, showAnimation = false);
    		model.resetTurntableRotation();
    		$$invalidate(4, modelViewer.cameraTarget = "0m 30m 0m", modelViewer);
    		model.autoRotate = false;

    		switch (el) {
    			case 0:
    				//Awake in a flash
    				model.cameraOrbit = "33.36deg 85.73deg 130m";
    				playRange(19, 2000);
    				break;
    			case 1:
    				//Universal cable connectivity
    				playRange(7, 2000);
    				$$invalidate(8, showAnimation = true);
    				model.cameraOrbit = "2.405deg 75.05deg 130m";
    				break;
    			case 2:
    				//Get thing done fast
    				playRange(13, 2000);
    				model.cameraOrbit = "0.9279deg 53.67deg 130m";
    				break;
    			case 3:
    				//Unplug for longer
    				playRange(2, 100);
    				model.cameraOrbit = "4.247deg 86.1deg 130m";
    				break;
    			case 4:
    				//Fast, realible connections
    				playRange(23, 2000);
    				model.cameraOrbit = "-32.6deg 80.2deg 130m";
    				break;
    			case 5:
    				//Immersive viewing
    				playRange(2, 100);
    				model.cameraOrbit = "-80.405deg 80.0deg 130m";
    				break;
    			default:
    				console.log("default");
    		}
    	}

    	const writable_props = ["content", "videos"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("content" in $$props) $$invalidate(0, content = $$props.content);
    		if ("videos" in $$props) $$invalidate(1, videos = $$props.videos);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		beforeUpdate,
    		afterUpdate,
    		Footer,
    		Header,
    		FeaturesList,
    		Model: _3DModel,
    		FeaturesDescription,
    		LoadingScreen,
    		BlurryScreen,
    		Legal,
    		ZoomGlass,
    		content,
    		videos,
    		optionClicked,
    		featureId,
    		modelViewer,
    		isModelVisible,
    		showLegal,
    		showBlurryScreen,
    		showAnimation,
    		isVisible,
    		playRange,
    		openDescription,
    		closeDescription,
    		removeHotspots: removeHotspots$1,
    		showHotspots: showHotspots$1,
    		openModalHandler,
    		closeModalHandler,
    		clickHS
    	});

    	$$self.$inject_state = $$props => {
    		if ("content" in $$props) $$invalidate(0, content = $$props.content);
    		if ("videos" in $$props) $$invalidate(1, videos = $$props.videos);
    		if ("optionClicked" in $$props) $$invalidate(2, optionClicked = $$props.optionClicked);
    		if ("featureId" in $$props) $$invalidate(3, featureId = $$props.featureId);
    		if ("modelViewer" in $$props) $$invalidate(4, modelViewer = $$props.modelViewer);
    		if ("isModelVisible" in $$props) $$invalidate(5, isModelVisible = $$props.isModelVisible);
    		if ("showLegal" in $$props) $$invalidate(6, showLegal = $$props.showLegal);
    		if ("showBlurryScreen" in $$props) $$invalidate(7, showBlurryScreen = $$props.showBlurryScreen);
    		if ("showAnimation" in $$props) $$invalidate(8, showAnimation = $$props.showAnimation);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		content,
    		videos,
    		optionClicked,
    		featureId,
    		modelViewer,
    		isModelVisible,
    		showLegal,
    		showBlurryScreen,
    		showAnimation,
    		isVisible,
    		openDescription,
    		closeDescription,
    		openModalHandler,
    		closeModalHandler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { content: 0, videos: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*content*/ ctx[0] === undefined && !("content" in props)) {
    			console_1.warn("<App> was created without expected prop 'content'");
    		}

    		if (/*videos*/ ctx[1] === undefined && !("videos" in props)) {
    			console_1.warn("<App> was created without expected prop 'videos'");
    		}
    	}

    	get content() {
    		return this.$$.ctx[0];
    	}

    	set content(content) {
    		this.$set({ content });
    		flush();
    	}

    	get videos() {
    		return this.$$.ctx[1];
    	}

    	set videos(videos) {
    		this.$set({ videos });
    		flush();
    	}
    }

    window.evo3DMobile = function ($el, content, videos) {
    	let app = new App({
    		target: $el,
    		props: {
    			content,
    			videos
    		}
    	});
    	return app;
    };

}());
//# sourceMappingURL=bundle.js.map
