
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
(function () {
    'use strict';

    function noop() { }
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
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    	let div1;
    	let div0;
    	let svg;
    	let g0;
    	let circle0;
    	let circle1;
    	let g1;
    	let path0;
    	let path1;
    	let g2;
    	let path2;
    	let path3;
    	let path4;
    	let t;
    	let p;

    	let raw_value = (/*open*/ ctx[1]
    	? /*copy*/ ctx[0].close_device
    	: /*copy*/ ctx[0].open_device) + "";

    	let p_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			g0 = svg_element("g");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			g1 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			g2 = svg_element("g");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			t = space();
    			p = element("p");
    			attr_dev(circle0, "class", "svgNone svelte-hzdnit");
    			attr_dev(circle0, "cx", "31.5");
    			attr_dev(circle0, "cy", "31.5");
    			attr_dev(circle0, "r", "31.5");
    			add_location(circle0, file, 179, 8, 5229);
    			attr_dev(circle1, "id", "circleSvg");
    			attr_dev(circle1, "class", "svgStroke svelte-hzdnit");
    			attr_dev(circle1, "cx", "31.5");
    			attr_dev(circle1, "cy", "31.5");
    			attr_dev(circle1, "r", "29");
    			add_location(circle1, file, 180, 8, 5293);
    			add_location(g0, file, 178, 6, 5217);
    			attr_dev(path0, "id", "closeSvg01");
    			attr_dev(path0, "class", "svgFill svelte-hzdnit");
    			attr_dev(path0, "d", "M42.9,44.5H12.8v-2.3h28.1l4.2-28.4l2.3,0.3L42.9,44.5z");
    			add_location(path0, file, 184, 8, 5415);
    			attr_dev(path1, "id", "closeSvg02");
    			attr_dev(path1, "class", "svgFill svelte-hzdnit");
    			attr_dev(path1, "d", "M17.3,32l-1.9-4.3l-1.8,0.9l3.2,7.4l7.2-3.6l-0.8-1.8l-4.2,2l0.9-2.6c3-8.2,11.8-12.5,19.6-9.7\n          l1.4,0.5l0.7-1.9l-1.4-0.5c-8.9-3.2-18.8,1.7-22.1,10.9L17.3,32z");
    			add_location(path1, file, 188, 8, 5552);
    			attr_dev(g1, "id", "CloseIconGroupe");
    			add_location(g1, file, 183, 6, 5382);
    			attr_dev(path2, "id", "openSvg01");
    			attr_dev(path2, "class", "svgFill svelte-hzdnit");
    			attr_dev(path2, "d", "M45.9,44.5H15.8v-2.3h30.1V44.5z");
    			add_location(path2, file, 196, 8, 5869);
    			attr_dev(path3, "id", "openSvg02");
    			attr_dev(path3, "class", "svgFill svelte-hzdnit");
    			attr_dev(path3, "d", "M46.2,42.3L16,38.5l0.2-2.3l30.3,3.7L46.2,42.3z");
    			add_location(path3, file, 200, 8, 5983);
    			attr_dev(path4, "id", "openSvg03");
    			attr_dev(path4, "class", "svgFill svelte-hzdnit");
    			attr_dev(path4, "d", "M38.2,17.9c-9.7-1.8-18.9,4.3-20.6,13.6l-0.3,1.4l2,0.4l0.3-1.4c1.5-8.2,9.7-13.6,18.2-12 l2.7,0.5l-3.9,2.5l1.2,1.6l6.7-4.4l-4.7-6.5l-1.7,1.1l2.7,3.8L38.2,17.9z");
    			add_location(path4, file, 204, 8, 6112);
    			attr_dev(g2, "id", "openIconGroupe");
    			set_style(g2, "visibility", "hidden");
    			add_location(g2, file, 195, 6, 5810);
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "id", "Close_device_icon");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg, "x", "0px");
    			attr_dev(svg, "y", "0px");
    			attr_dev(svg, "viewBox", "0 0 63 63");
    			set_style(svg, "enable-background", "new 0 0 63 63");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file, 168, 4, 4938);
    			attr_dev(div0, "class", "img-container svelte-hzdnit");
    			add_location(div0, file, 167, 2, 4906);
    			attr_dev(p, "id", "closeLabel");

    			attr_dev(p, "class", p_class_value = "" + (null_to_empty(/*open*/ ctx[1]
    			? "close-device-normal"
    			: "close-device-selected") + " svelte-hzdnit"));

    			add_location(p, file, 212, 2, 6478);
    			attr_dev(div1, "class", "close-device svelte-hzdnit");
    			add_location(div1, file, 162, 0, 4788);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, svg);
    			append_dev(svg, g0);
    			append_dev(g0, circle0);
    			append_dev(g0, circle1);
    			append_dev(svg, g1);
    			append_dev(g1, path0);
    			append_dev(g1, path1);
    			append_dev(svg, g2);
    			append_dev(g2, path2);
    			append_dev(g2, path3);
    			append_dev(g2, path4);
    			append_dev(div1, t);
    			append_dev(div1, p);
    			p.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*playRange*/ ctx[2], false, false, false),
    					listen_dev(div1, "mouseenter", hoverHandler, false, false, false),
    					listen_dev(div1, "mouseleave", rollOutHandler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*open, copy*/ 3 && raw_value !== (raw_value = (/*open*/ ctx[1]
    			? /*copy*/ ctx[0].close_device
    			: /*copy*/ ctx[0].open_device) + "")) p.innerHTML = raw_value;
    			if (dirty & /*open*/ 2 && p_class_value !== (p_class_value = "" + (null_to_empty(/*open*/ ctx[1]
    			? "close-device-normal"
    			: "close-device-selected") + " svelte-hzdnit"))) {
    				attr_dev(p, "class", p_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
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

    function removeHotspots() {
    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		hotspots[i].style.visibility = "hidden";
    	}
    }

    function showHotspots() {
    	let hotspots = document.getElementsByClassName("hotspot");

    	for (var i = 0; i < hotspots.length; i++) {
    		hotspots[i].style.visibility = "visible";
    	}
    }

    function hoverHandler() {
    	//Share svg assets
    	let Label = document.getElementById("closeLabel");

    	Label.style.color = "#149ED9";
    	let circleSvg = document.getElementById("circleSvg");
    	circleSvg.style.stroke = "#1299d6";

    	//opened svg assets
    	let closeSvg01 = document.getElementById("closeSvg01");

    	let closeSvg02 = document.getElementById("closeSvg02");
    	closeSvg01.style.stroke = "#1299d6";
    	closeSvg02.style.stroke = "#1299d6";
    	closeSvg01.style.fill = "#1299d6";
    	closeSvg02.style.fill = "#1299d6";

    	//opened svg assets
    	let openSvg01 = document.getElementById("openSvg01");

    	let openSvg02 = document.getElementById("openSvg02");
    	let openSvg03 = document.getElementById("openSvg03");
    	openSvg01.style.stroke = "#1299d6";
    	openSvg02.style.stroke = "#1299d6";
    	openSvg03.style.stroke = "#1299d6";
    	openSvg01.style.fill = "#1299d6";
    	openSvg02.style.fill = "#1299d6";
    	openSvg03.style.fill = "#1299d6";
    }

    function rollOutHandler() {
    	//Share svg assets
    	let Label = document.getElementById("closeLabel");

    	Label.style.color = "#ffffff";
    	let circleSvg = document.getElementById("circleSvg");
    	circleSvg.style.stroke = "#ffffff";

    	//opened svg assets
    	let closeSvg01 = document.getElementById("closeSvg01");

    	let closeSvg02 = document.getElementById("closeSvg02");
    	closeSvg01.style.stroke = "#ffffff";
    	closeSvg02.style.stroke = "#ffffff";
    	closeSvg01.style.fill = "#ffffff";
    	closeSvg02.style.fill = "#ffffff";

    	//opened svg assets
    	let openSvg01 = document.getElementById("openSvg01");

    	let openSvg02 = document.getElementById("openSvg02");
    	let openSvg03 = document.getElementById("openSvg03");
    	openSvg01.style.stroke = "#ffffff";
    	openSvg02.style.stroke = "#ffffff";
    	openSvg03.style.stroke = "#ffffff";
    	openSvg01.style.fill = "#ffffff";
    	openSvg02.style.fill = "#ffffff";
    	openSvg03.style.fill = "#ffffff";
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("CloseDevice", slots, []);
    	let { copy } = $$props;
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
    			let CloseIconGroupe = document.getElementById("CloseIconGroupe");
    			CloseIconGroupe.style.visibility = "hidden";
    			openIconGroupe.style.visibility = "visible";
    			let allAnimationHolders = document.getElementsByClassName("overlaysFXs");

    			for (var i = 0, len = allAnimationHolders.length; i < len; i++) {
    				allAnimationHolders[i].style.opacity = 0;
    			}

    			animationFinished = false;
    			removeHotspots();
    			modelViewer.currentTime = "3";

    			animationPause = setTimeout(
    				function () {
    					modelViewer.pause();
    					$$invalidate(1, open = false);
    					animationFinished = true;
    				},
    				1000
    			);
    		} else if (!open && animationFinished) {
    			openIconGroupe.style.visibility = "hidden";
    			CloseIconGroupe.style.visibility = "visible";
    			animationFinished = false;
    			modelViewer.currentTime = "5";

    			animationPause = setTimeout(
    				function () {
    					modelViewer.pause();
    					$$invalidate(1, open = true);
    					showHotspots();
    					animationFinished = true;
    					let allAnimationHolders = document.getElementsByClassName("overlaysFXs");

    					for (var i = 0, len = allAnimationHolders.length; i < len; i++) {
    						allAnimationHolders[i].style.opacity = 1;
    					}
    				},
    				600
    			);
    		}
    	}

    	const writable_props = ["copy"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<CloseDevice> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		copy,
    		modelViewer,
    		open,
    		animationFinished,
    		playRange,
    		removeHotspots,
    		showHotspots,
    		hoverHandler,
    		rollOutHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("modelViewer" in $$props) modelViewer = $$props.modelViewer;
    		if ("open" in $$props) $$invalidate(1, open = $$props.open);
    		if ("animationFinished" in $$props) animationFinished = $$props.animationFinished;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [copy, open, playRange];
    }

    class CloseDevice extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { copy: 0 });

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
    	}

    	get copy() {
    		throw new Error("<CloseDevice>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set copy(value) {
    		throw new Error("<CloseDevice>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.29.0 */
    const file$1 = "src/components/Footer.svelte";

    function create_fragment$1(ctx) {
    	let div6;
    	let div5;
    	let div3;
    	let div1;
    	let closedevice;
    	let t0;
    	let div0;
    	let t1;
    	let div2;
    	let p0;
    	let t2_value = /*copy*/ ctx[0].legal.copy + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4_value = /*copy*/ ctx[0].legal.link + "";
    	let t4;
    	let t5;
    	let div4;
    	let img;
    	let img_src_value;
    	let current;
    	let mounted;
    	let dispose;

    	closedevice = new CloseDevice({
    			props: { copy: /*copy*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div3 = element("div");
    			div1 = element("div");
    			create_component(closedevice.$$.fragment);
    			t0 = space();
    			div0 = element("div");
    			t1 = space();
    			div2 = element("div");
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div4 = element("div");
    			img = element("img");
    			add_location(div0, file$1, 84, 8, 1971);
    			attr_dev(div1, "class", "close-container svelte-113y087");
    			add_location(div1, file$1, 82, 6, 1902);
    			add_location(p0, file$1, 87, 8, 2036);
    			attr_dev(p1, "class", "legal-link svelte-113y087");
    			add_location(p1, file$1, 88, 8, 2069);
    			attr_dev(div2, "class", "legal-container svelte-113y087");
    			add_location(div2, file$1, 86, 6, 1998);
    			attr_dev(div3, "class", "close-legal-container svelte-113y087");
    			add_location(div3, file$1, 81, 4, 1860);
    			attr_dev(img, "class", "img");
    			if (img.src !== (img_src_value = /*logo*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "evo checkmark");
    			add_location(img, file$1, 92, 6, 2256);
    			attr_dev(div4, "class", "evo-checkmark svelte-113y087");
    			add_location(div4, file$1, 91, 4, 2222);
    			attr_dev(div5, "class", "container svelte-113y087");
    			add_location(div5, file$1, 80, 2, 1832);
    			attr_dev(div6, "class", "footer svelte-113y087");
    			add_location(div6, file$1, 79, 0, 1809);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div3);
    			append_dev(div3, div1);
    			mount_component(closedevice, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, p0);
    			append_dev(p0, t2);
    			append_dev(div2, t3);
    			append_dev(div2, p1);
    			append_dev(p1, t4);
    			append_dev(div5, t5);
    			append_dev(div5, div4);
    			append_dev(div4, img);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(p1, "click", /*openLegal*/ ctx[2], false, false, false),
    					listen_dev(p1, "mouseenter", hoverHandler$1, false, false, false),
    					listen_dev(p1, "mouseleave", rollOutHandler$1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const closedevice_changes = {};
    			if (dirty & /*copy*/ 1) closedevice_changes.copy = /*copy*/ ctx[0];
    			closedevice.$set(closedevice_changes);
    			if ((!current || dirty & /*copy*/ 1) && t2_value !== (t2_value = /*copy*/ ctx[0].legal.copy + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*copy*/ 1) && t4_value !== (t4_value = /*copy*/ ctx[0].legal.link + "")) set_data_dev(t4, t4_value);

    			if (!current || dirty & /*logo*/ 2 && img.src !== (img_src_value = /*logo*/ ctx[1])) {
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
    			if (detaching) detach_dev(div6);
    			destroy_component(closedevice);
    			mounted = false;
    			run_all(dispose);
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

    function hoverHandler$1() {
    	this.style.color = "#149ED9";
    }

    function rollOutHandler$1() {
    	this.style.color = "#a0a0a0";
    }

    function animation() {
    	var animation_TL = new TimelineMax();
    	animation_TL.add("init", "1");
    	animation_TL.to(".footer", 2, { opacity: 1, ease: "Circ.easeOut" }, "init");
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Footer", slots, []);
    	let { copy } = $$props;
    	let { logo } = $$props;
    	const dispatch = createEventDispatcher();

    	function openLegal() {
    		dispatch("open-modal", true);
    	}

    	onMount(() => {
    		animation();
    	});

    	const writable_props = ["copy", "logo"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("logo" in $$props) $$invalidate(1, logo = $$props.logo);
    	};

    	$$self.$capture_state = () => ({
    		CloseDevice,
    		createEventDispatcher,
    		onMount,
    		copy,
    		logo,
    		dispatch,
    		openLegal,
    		hoverHandler: hoverHandler$1,
    		rollOutHandler: rollOutHandler$1,
    		animation
    	});

    	$$self.$inject_state = $$props => {
    		if ("copy" in $$props) $$invalidate(0, copy = $$props.copy);
    		if ("logo" in $$props) $$invalidate(1, logo = $$props.logo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [copy, logo, openLegal];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { copy: 0, logo: 1 });

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

    		if (/*logo*/ ctx[1] === undefined && !("logo" in props)) {
    			console.warn("<Footer> was created without expected prop 'logo'");
    		}
    	}

    	get copy() {
    		throw new Error("<Footer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set copy(value) {
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
    	let div2;
    	let h3;
    	let t0;
    	let t1;
    	let div1;
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
    			div2 = element("div");
    			h3 = element("h3");
    			t0 = text(/*headline*/ ctx[0]);
    			t1 = space();
    			div1 = element("div");
    			p = element("p");
    			t2 = text(/*subheadline*/ ctx[1]);
    			t3 = space();
    			div0 = element("div");
    			img0 = element("img");
    			t4 = space();
    			img1 = element("img");
    			t5 = space();
    			img2 = element("img");
    			attr_dev(h3, "class", "svelte-1ez49zi");
    			add_location(h3, file$2, 72, 4, 2045);
    			attr_dev(p, "class", "subheadline svelte-1ez49zi");
    			add_location(p, file$2, 74, 8, 2101);
    			attr_dev(img0, "id", "arrow01");
    			attr_dev(img0, "class", "img arrow svelte-1ez49zi");
    			if (img0.src !== (img0_src_value = /*arrow*/ ctx[2])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "down arrow");
    			add_location(img0, file$2, 76, 12, 2187);
    			attr_dev(img1, "id", "arrow02");
    			attr_dev(img1, "class", "img arrow svelte-1ez49zi");
    			if (img1.src !== (img1_src_value = /*arrow*/ ctx[2])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "down arrow");
    			add_location(img1, file$2, 77, 12, 2267);
    			attr_dev(img2, "id", "arrow03");
    			attr_dev(img2, "class", "img arrow svelte-1ez49zi");
    			if (img2.src !== (img2_src_value = /*arrow*/ ctx[2])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "down arrow");
    			add_location(img2, file$2, 78, 12, 2347);
    			attr_dev(div0, "class", "down-arrow svelte-1ez49zi");
    			add_location(div0, file$2, 75, 8, 2150);
    			attr_dev(div1, "id", "instructions");
    			add_location(div1, file$2, 73, 4, 2069);
    			attr_dev(div2, "class", "header svelte-1ez49zi");
    			add_location(div2, file$2, 71, 0, 2020);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h3);
    			append_dev(h3, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
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
    			if (detaching) detach_dev(div2);
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

    function animation$1() {
    	var animation_TL = new TimelineMax();
    	animation_TL.add("init");
    	animation_TL.from("h3", 1, { y: "-200rem", ease: "Circ.easeOut" }, "init");
    	animation_TL.to("h3", 2, { opacity: 1, ease: "Circ.easeOut" }, "init");
    	animation_TL.to(".subheadline", 1, { opacity: 1, ease: "Circ.easeInOut" }, "init+=1.5");
    	animation_TL.to(".down-arrow", 1, { opacity: 0.5, ease: "Circ.easeInOut" }, "init+=2");
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
    		animation$1();
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
    		mount_component,
    		onMount,
    		headline,
    		subheadline,
    		arrow,
    		animation: animation$1
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

    /* src/components/HotspotDescription.svelte generated by Svelte v3.29.0 */
    const file$3 = "src/components/HotspotDescription.svelte";

    function create_fragment$3(ctx) {
    	let div5;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let div4;
    	let div0;
    	let p0;
    	let t1;
    	let p1;
    	let t2;
    	let div3;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let div1_class_value;
    	let t3;
    	let div2;
    	let img2;
    	let img2_src_value;
    	let t4;
    	let p2;
    	let t5;
    	let div2_class_value;
    	let div5_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			img0 = element("img");
    			t0 = space();
    			div4 = element("div");
    			div0 = element("div");
    			p0 = element("p");
    			t1 = space();
    			p1 = element("p");
    			t2 = space();
    			div3 = element("div");
    			div1 = element("div");
    			img1 = element("img");
    			t3 = space();
    			div2 = element("div");
    			img2 = element("img");
    			t4 = space();
    			p2 = element("p");
    			t5 = text(/*backCopy*/ ctx[4]);
    			attr_dev(img0, "class", "selected-Checkmark svelte-10l5b1");
    			if (img0.src !== (img0_src_value = /*selectedCheckmark*/ ctx[7])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "back");
    			add_location(img0, file$3, 182, 2, 4365);
    			attr_dev(p0, "class", "title svelte-10l5b1");
    			add_location(p0, file$3, 186, 6, 4488);
    			attr_dev(p1, "class", "subtitle svelte-10l5b1");
    			add_location(p1, file$3, 189, 6, 4545);
    			attr_dev(div0, "class", "header svelte-10l5b1");
    			add_location(div0, file$3, 185, 4, 4461);
    			attr_dev(img1, "id", "videoImg");
    			attr_dev(img1, "class", "img svelte-10l5b1");
    			if (img1.src !== (img1_src_value = /*thumbnail*/ ctx[2])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "video");
    			add_location(img1, file$3, 199, 8, 4858);

    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "thumbnail right-alignedVideo"
    			: "thumbnail") + " svelte-10l5b1"));

    			add_location(div1, file$3, 194, 6, 4653);
    			attr_dev(img2, "id", "backSVG");
    			attr_dev(img2, "class", "img back-arrow svelte-10l5b1");
    			if (img2.src !== (img2_src_value = /*backArrowIcon*/ ctx[3])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "back");
    			add_location(img2, file$3, 204, 8, 5026);
    			attr_dev(p2, "id", "backLabel");
    			attr_dev(p2, "class", "back-button svelte-10l5b1");
    			add_location(p2, file$3, 209, 8, 5149);

    			attr_dev(div2, "class", div2_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "back right-alignedBack"
    			: "back") + " svelte-10l5b1"));

    			add_location(div2, file$3, 201, 6, 4939);
    			attr_dev(div3, "class", "video-container svelte-10l5b1");
    			add_location(div3, file$3, 193, 4, 4617);
    			attr_dev(div4, "class", "body svelte-10l5b1");
    			add_location(div4, file$3, 184, 2, 4438);

    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "feature-description right-aligned"
    			: "feature-description") + " svelte-10l5b1"));

    			set_style(div5, "margin", /*margin*/ ctx[5]);
    			add_location(div5, file$3, 179, 0, 4245);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, img0);
    			append_dev(div5, t0);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			append_dev(div0, p0);
    			p0.innerHTML = /*title*/ ctx[0];
    			append_dev(div0, t1);
    			append_dev(div0, p1);
    			p1.innerHTML = /*subtitle*/ ctx[1];
    			append_dev(div4, t2);
    			append_dev(div4, div3);
    			append_dev(div3, div1);
    			append_dev(div1, img1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, img2);
    			append_dev(div2, t4);
    			append_dev(div2, p2);
    			append_dev(p2, t5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*openVideo*/ ctx[9], false, false, false),
    					listen_dev(div1, "mouseenter", videoHoverHandler, false, false, false),
    					listen_dev(div1, "mouseleave", videoRollOutHandler, false, false, false),
    					listen_dev(p2, "click", /*back*/ ctx[8], false, false, false),
    					listen_dev(p2, "mouseenter", backHoverHandler, false, false, false),
    					listen_dev(p2, "mouseleave", backRollOutHandler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*selectedCheckmark*/ 128 && img0.src !== (img0_src_value = /*selectedCheckmark*/ ctx[7])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (dirty & /*title*/ 1) p0.innerHTML = /*title*/ ctx[0];			if (dirty & /*subtitle*/ 2) p1.innerHTML = /*subtitle*/ ctx[1];
    			if (dirty & /*thumbnail*/ 4 && img1.src !== (img1_src_value = /*thumbnail*/ ctx[2])) {
    				attr_dev(img1, "src", img1_src_value);
    			}

    			if (dirty & /*rightAligned*/ 64 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "thumbnail right-alignedVideo"
    			: "thumbnail") + " svelte-10l5b1"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*backArrowIcon*/ 8 && img2.src !== (img2_src_value = /*backArrowIcon*/ ctx[3])) {
    				attr_dev(img2, "src", img2_src_value);
    			}

    			if (dirty & /*backCopy*/ 16) set_data_dev(t5, /*backCopy*/ ctx[4]);

    			if (dirty & /*rightAligned*/ 64 && div2_class_value !== (div2_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "back right-alignedBack"
    			: "back") + " svelte-10l5b1"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}

    			if (dirty & /*rightAligned*/ 64 && div5_class_value !== (div5_class_value = "" + (null_to_empty(/*rightAligned*/ ctx[6]
    			? "feature-description right-aligned"
    			: "feature-description") + " svelte-10l5b1"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty & /*margin*/ 32) {
    				set_style(div5, "margin", /*margin*/ ctx[5]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			mounted = false;
    			run_all(dispose);
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

    function videoHoverHandler() {
    	let videoImg = document.getElementById("videoImg");
    	videoImg.style.border = "solid 1px #149ED9";
    }

    function videoRollOutHandler() {
    	let videoImg = document.getElementById("videoImg");
    	videoImg.style.border = "solid 1px #404040";
    }

    function backHoverHandler() {
    	let backLabel = document.getElementById("backLabel");
    	let backSVG = document.getElementById("backSVG");
    	backLabel.style.color = "#149ED9";
    	backSVG.style.opacity = 1;
    }

    function backRollOutHandler() {
    	let backLabel = document.getElementById("backLabel");
    	let backSVG = document.getElementById("backSVG");
    	backLabel.style.color = "#ffffff";
    	backSVG.style.opacity = 0.75;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("HotspotDescription", slots, []);
    	let { title = "" } = $$props;
    	let { subtitle = "" } = $$props;
    	let { thumbnail = "" } = $$props;
    	let { backArrowIcon = "" } = $$props;
    	let { backCopy = "" } = $$props;
    	let { margin = "" } = $$props;
    	let { rightAligned = "" } = $$props;
    	let { selectedCheckmark = "" } = $$props;
    	let initialPos;

    	onMount(() => {
    		animationIn();
    	});

    	function animationIn() {
    		//Hide instructions
    		let instructions = document.getElementById("instructions");

    		if (rightAligned) {
    			initialPos = "-10%";
    		} else {
    			initialPos = "+10%";
    		}

    		var animationIn_TL = new TimelineMax();
    		animationIn_TL.set([instructions, ".title", ".subtitle", ".video-container", ".back"], { opacity: 0 }).add("init").staggerTo([".title", ".subtitle", ".video-container", ".back"], 0, { opacity: 1 }, 0.1, "init").from(".body", 2, { x: initialPos }, "init");
    	}

    	function animationOut() {
    		var animationOut_TL = new TimelineMax();

    		animationOut_TL.add("init").to(".body", 0.2, { opacity: 0 }, "init").add(function () {
    			dispatch("close", false);
    		}).to([instructions], 0.5, { opacity: 1 });
    	}

    	const dispatch = createEventDispatcher();

    	function back() {
    		animationOut();
    	}

    	function openVideo() {
    		dispatch("open-video", true);
    	}

    	const writable_props = [
    		"title",
    		"subtitle",
    		"thumbnail",
    		"backArrowIcon",
    		"backCopy",
    		"margin",
    		"rightAligned",
    		"selectedCheckmark"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<HotspotDescription> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ("thumbnail" in $$props) $$invalidate(2, thumbnail = $$props.thumbnail);
    		if ("backArrowIcon" in $$props) $$invalidate(3, backArrowIcon = $$props.backArrowIcon);
    		if ("backCopy" in $$props) $$invalidate(4, backCopy = $$props.backCopy);
    		if ("margin" in $$props) $$invalidate(5, margin = $$props.margin);
    		if ("rightAligned" in $$props) $$invalidate(6, rightAligned = $$props.rightAligned);
    		if ("selectedCheckmark" in $$props) $$invalidate(7, selectedCheckmark = $$props.selectedCheckmark);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onMount,
    		title,
    		subtitle,
    		thumbnail,
    		backArrowIcon,
    		backCopy,
    		margin,
    		rightAligned,
    		selectedCheckmark,
    		initialPos,
    		animationIn,
    		animationOut,
    		dispatch,
    		back,
    		openVideo,
    		videoHoverHandler,
    		videoRollOutHandler,
    		backHoverHandler,
    		backRollOutHandler
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ("thumbnail" in $$props) $$invalidate(2, thumbnail = $$props.thumbnail);
    		if ("backArrowIcon" in $$props) $$invalidate(3, backArrowIcon = $$props.backArrowIcon);
    		if ("backCopy" in $$props) $$invalidate(4, backCopy = $$props.backCopy);
    		if ("margin" in $$props) $$invalidate(5, margin = $$props.margin);
    		if ("rightAligned" in $$props) $$invalidate(6, rightAligned = $$props.rightAligned);
    		if ("selectedCheckmark" in $$props) $$invalidate(7, selectedCheckmark = $$props.selectedCheckmark);
    		if ("initialPos" in $$props) initialPos = $$props.initialPos;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		title,
    		subtitle,
    		thumbnail,
    		backArrowIcon,
    		backCopy,
    		margin,
    		rightAligned,
    		selectedCheckmark,
    		back,
    		openVideo
    	];
    }

    class HotspotDescription extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			title: 0,
    			subtitle: 1,
    			thumbnail: 2,
    			backArrowIcon: 3,
    			backCopy: 4,
    			margin: 5,
    			rightAligned: 6,
    			selectedCheckmark: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HotspotDescription",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get title() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subtitle() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subtitle(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get thumbnail() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set thumbnail(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backArrowIcon() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backArrowIcon(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backCopy() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backCopy(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get margin() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set margin(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rightAligned() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rightAligned(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedCheckmark() {
    		throw new Error("<HotspotDescription>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedCheckmark(value) {
    		throw new Error("<HotspotDescription>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/HotspotConnectionLine.svelte generated by Svelte v3.29.0 */
    const file$4 = "src/components/custom/HotspotConnectionLine.svelte";

    function create_fragment$4(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "hotspot-line svelte-dk6l3b");
    			set_style(div, "width", /*width*/ ctx[0]);
    			set_style(div, "margin", /*margin*/ ctx[2]);
    			set_style(div, "transform", /*rotate*/ ctx[1]);
    			add_location(div, file$4, 33, 0, 733);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*width*/ 1) {
    				set_style(div, "width", /*width*/ ctx[0]);
    			}

    			if (dirty & /*margin*/ 4) {
    				set_style(div, "margin", /*margin*/ ctx[2]);
    			}

    			if (dirty & /*rotate*/ 2) {
    				set_style(div, "transform", /*rotate*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
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

    function animationIn() {
    	var animationIn_TL = new TimelineMax();
    	animationIn_TL.add("init").from([".hotspot-line"], 1, { borderWidth: "0" }, "init").from([".hotspot-line"], 0.75, { scale: 0 }, "init").to([".hotspot-line"], 1, { opacity: 1 }, "init");
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("HotspotConnectionLine", slots, []);
    	let { width = "" } = $$props;
    	let { rotate = "" } = $$props;
    	let { margin = "" } = $$props;

    	onMount(() => {
    		animationIn();
    	});

    	const writable_props = ["width", "rotate", "margin"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<HotspotConnectionLine> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("width" in $$props) $$invalidate(0, width = $$props.width);
    		if ("rotate" in $$props) $$invalidate(1, rotate = $$props.rotate);
    		if ("margin" in $$props) $$invalidate(2, margin = $$props.margin);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		width,
    		rotate,
    		margin,
    		animationIn
    	});

    	$$self.$inject_state = $$props => {
    		if ("width" in $$props) $$invalidate(0, width = $$props.width);
    		if ("rotate" in $$props) $$invalidate(1, rotate = $$props.rotate);
    		if ("margin" in $$props) $$invalidate(2, margin = $$props.margin);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, rotate, margin];
    }

    class HotspotConnectionLine extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { width: 0, rotate: 1, margin: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HotspotConnectionLine",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get width() {
    		throw new Error("<HotspotConnectionLine>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<HotspotConnectionLine>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rotate() {
    		throw new Error("<HotspotConnectionLine>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rotate(value) {
    		throw new Error("<HotspotConnectionLine>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get margin() {
    		throw new Error("<HotspotConnectionLine>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set margin(value) {
    		throw new Error("<HotspotConnectionLine>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/Model.svelte generated by Svelte v3.29.0 */

    const { console: console_1 } = globals;
    const file$5 = "src/components/custom/Model.svelte";

    // (619:6) {#if modelTime >= 1.5}
    function create_if_block(ctx) {
    	let button0;
    	let div1;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let div0;
    	let t2;
    	let t3;
    	let t4;
    	let button1;
    	let div3;
    	let img2;
    	let img2_src_value;
    	let t5;
    	let img3;
    	let img3_src_value;
    	let t6;
    	let div2;
    	let t7;
    	let t8;
    	let t9;
    	let button2;
    	let div5;
    	let img4;
    	let img4_src_value;
    	let t10;
    	let img5;
    	let img5_src_value;
    	let t11;
    	let div4;
    	let t12;
    	let t13;
    	let t14;
    	let button3;
    	let div7;
    	let img6;
    	let img6_src_value;
    	let t15;
    	let img7;
    	let img7_src_value;
    	let t16;
    	let div6;
    	let t17;
    	let t18;
    	let t19;
    	let button4;
    	let div9;
    	let img8;
    	let img8_src_value;
    	let t20;
    	let img9;
    	let img9_src_value;
    	let t21;
    	let div8;
    	let t22;
    	let t23;
    	let t24;
    	let button5;
    	let div11;
    	let img10;
    	let img10_src_value;
    	let t25;
    	let img11;
    	let img11_src_value;
    	let t26;
    	let div10;
    	let t27;
    	let t28;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = !(/*id*/ ctx[13] == 0) && create_if_block_12(ctx);
    	let if_block1 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 0 && create_if_block_11(ctx);
    	let if_block2 = !(/*id*/ ctx[13] == 1) && create_if_block_10(ctx);
    	let if_block3 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 1 && create_if_block_9(ctx);
    	let if_block4 = !(/*id*/ ctx[13] == 2) && create_if_block_8(ctx);
    	let if_block5 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 2 && create_if_block_7(ctx);
    	let if_block6 = !(/*id*/ ctx[13] == 3) && create_if_block_6(ctx);
    	let if_block7 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 3 && create_if_block_5(ctx);
    	let if_block8 = !(/*id*/ ctx[13] == 4) && create_if_block_4(ctx);
    	let if_block9 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 4 && create_if_block_3(ctx);
    	let if_block10 = !(/*id*/ ctx[13] == 5) && create_if_block_2(ctx);
    	let if_block11 = /*showDescription*/ ctx[12] && /*id*/ ctx[13] == 5 && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			div1 = element("div");
    			img0 = element("img");
    			t0 = space();
    			img1 = element("img");
    			t1 = space();
    			div0 = element("div");
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			t4 = space();
    			button1 = element("button");
    			div3 = element("div");
    			img2 = element("img");
    			t5 = space();
    			img3 = element("img");
    			t6 = space();
    			div2 = element("div");
    			t7 = space();
    			if (if_block2) if_block2.c();
    			t8 = space();
    			if (if_block3) if_block3.c();
    			t9 = space();
    			button2 = element("button");
    			div5 = element("div");
    			img4 = element("img");
    			t10 = space();
    			img5 = element("img");
    			t11 = space();
    			div4 = element("div");
    			t12 = space();
    			if (if_block4) if_block4.c();
    			t13 = space();
    			if (if_block5) if_block5.c();
    			t14 = space();
    			button3 = element("button");
    			div7 = element("div");
    			img6 = element("img");
    			t15 = space();
    			img7 = element("img");
    			t16 = space();
    			div6 = element("div");
    			t17 = space();
    			if (if_block6) if_block6.c();
    			t18 = space();
    			if (if_block7) if_block7.c();
    			t19 = space();
    			button4 = element("button");
    			div9 = element("div");
    			img8 = element("img");
    			t20 = space();
    			img9 = element("img");
    			t21 = space();
    			div8 = element("div");
    			t22 = space();
    			if (if_block8) if_block8.c();
    			t23 = space();
    			if (if_block9) if_block9.c();
    			t24 = space();
    			button5 = element("button");
    			div11 = element("div");
    			img10 = element("img");
    			t25 = space();
    			img11 = element("img");
    			t26 = space();
    			div10 = element("div");
    			t27 = space();
    			if (if_block10) if_block10.c();
    			t28 = space();
    			if (if_block11) if_block11.c();
    			attr_dev(img0, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img0.src !== (img0_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "close-device");
    			add_location(img0, file$5, 633, 12, 15753);
    			attr_dev(img1, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img1.src !== (img1_src_value = /*checkmark*/ ctx[7])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "close-device");
    			add_location(img1, file$5, 637, 12, 15900);
    			attr_dev(div0, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div0, file$5, 641, 12, 16044);
    			attr_dev(div1, "class", "showDescriptionHandler");
    			add_location(div1, file$5, 628, 10, 15553);
    			attr_dev(button0, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button0, "slot", "hotspot-1");
    			attr_dev(button0, "alt", "hotspot");
    			attr_dev(button0, "data-position", "28m 68m -44m");
    			attr_dev(button0, "data-normal", ".5m 3.56m 5m");
    			attr_dev(button0, "data-visibility-attribute", "visible");
    			attr_dev(button0, "id", "animation01");
    			add_location(button0, file$5, 620, 8, 15308);
    			attr_dev(img2, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img2.src !== (img2_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "close-device");
    			add_location(img2, file$5, 679, 12, 17401);
    			attr_dev(img3, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img3.src !== (img3_src_value = /*checkmark*/ ctx[7])) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "close-device");
    			add_location(img3, file$5, 683, 12, 17548);
    			attr_dev(div2, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div2, file$5, 687, 12, 17692);
    			attr_dev(div3, "class", "showDescriptionHandler");
    			add_location(div3, file$5, 674, 10, 17201);
    			attr_dev(button1, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button1, "slot", "hotspot-2");
    			attr_dev(button1, "alt", "hotspot");
    			attr_dev(button1, "data-position", "-28m 56m -43m");
    			attr_dev(button1, "data-normal", "-0.6m 1m 2m");
    			attr_dev(button1, "data-visibility-attribute", "visible");
    			attr_dev(button1, "id", "animation02");
    			add_location(button1, file$5, 666, 8, 16956);
    			attr_dev(img4, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img4.src !== (img4_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img4, "src", img4_src_value);
    			attr_dev(img4, "alt", "close-device");
    			add_location(img4, file$5, 726, 12, 19090);
    			attr_dev(img5, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img5.src !== (img5_src_value = /*checkmark*/ ctx[7])) attr_dev(img5, "src", img5_src_value);
    			attr_dev(img5, "alt", "close-device");
    			add_location(img5, file$5, 730, 12, 19237);
    			attr_dev(div4, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div4, file$5, 734, 12, 19381);
    			attr_dev(div5, "class", "showDescriptionHandler");
    			add_location(div5, file$5, 721, 10, 18890);
    			attr_dev(button2, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button2, "slot", "hotspot-3");
    			attr_dev(button2, "alt", "hotspot");
    			attr_dev(button2, "data-position", "40m 19.5m 4m");
    			attr_dev(button2, "data-normal", "0.6m 3.5m 0.2m");
    			attr_dev(button2, "data-visibility-attribute", "visible");
    			attr_dev(button2, "id", "animation03");
    			add_location(button2, file$5, 713, 8, 18643);
    			attr_dev(img6, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img6.src !== (img6_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img6, "src", img6_src_value);
    			attr_dev(img6, "alt", "close-device");
    			add_location(img6, file$5, 771, 12, 20736);
    			attr_dev(img7, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img7.src !== (img7_src_value = /*checkmark*/ ctx[7])) attr_dev(img7, "src", img7_src_value);
    			attr_dev(img7, "alt", "close-device");
    			add_location(img7, file$5, 775, 12, 20883);
    			attr_dev(div6, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div6, file$5, 779, 12, 21027);
    			attr_dev(div7, "class", "showDescriptionHandler");
    			add_location(div7, file$5, 766, 10, 20536);
    			attr_dev(button3, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button3, "slot", "hotspot-4");
    			attr_dev(button3, "alt", "hotspot");
    			attr_dev(button3, "data-position", "25m 14.5m 28m");
    			attr_dev(button3, "data-normal", "0m 0.5m 5m");
    			attr_dev(button3, "data-visibility-attribute", "visible");
    			attr_dev(button3, "id", "animation04");
    			add_location(button3, file$5, 758, 8, 20292);
    			attr_dev(img8, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img8.src !== (img8_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img8, "src", img8_src_value);
    			attr_dev(img8, "alt", "close-device");
    			add_location(img8, file$5, 817, 12, 22401);
    			attr_dev(img9, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img9.src !== (img9_src_value = /*checkmark*/ ctx[7])) attr_dev(img9, "src", img9_src_value);
    			attr_dev(img9, "alt", "close-device");
    			add_location(img9, file$5, 821, 12, 22548);
    			attr_dev(div8, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div8, file$5, 825, 12, 22692);
    			attr_dev(div9, "class", "showDescriptionHandler");
    			add_location(div9, file$5, 812, 10, 22201);
    			attr_dev(button4, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button4, "slot", "hotspot-5");
    			attr_dev(button4, "alt", "hotspot");
    			attr_dev(button4, "data-position", "-50m 25m -35m");
    			attr_dev(button4, "data-normal", "-0.6m -0.3m 0.5m");
    			attr_dev(button4, "data-visibility-attribute", "visible");
    			attr_dev(button4, "id", "animation05");
    			add_location(button4, file$5, 804, 8, 21951);
    			attr_dev(img10, "class", "img blue-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img10.src !== (img10_src_value = /*blueCheckmark*/ ctx[8])) attr_dev(img10, "src", img10_src_value);
    			attr_dev(img10, "alt", "close-device");
    			add_location(img10, file$5, 863, 12, 24099);
    			attr_dev(img11, "class", "img white-checkmark noMouseInteraction svelte-11v3uqj");
    			if (img11.src !== (img11_src_value = /*checkmark*/ ctx[7])) attr_dev(img11, "src", img11_src_value);
    			attr_dev(img11, "alt", "close-device");
    			add_location(img11, file$5, 867, 12, 24246);
    			attr_dev(div10, "class", "circle scale-in-center noMouseInteraction svelte-11v3uqj");
    			add_location(div10, file$5, 871, 12, 24390);
    			attr_dev(div11, "class", "showDescriptionHandler");
    			add_location(div11, file$5, 858, 10, 23899);
    			attr_dev(button5, "class", "hotspot svelte-11v3uqj");
    			attr_dev(button5, "slot", "hotspot-6");
    			attr_dev(button5, "alt", "hotspot");
    			attr_dev(button5, "data-position", "-50m 11.5m -20m");
    			attr_dev(button5, "data-normal", "-0.6m 0m 0.5m");
    			attr_dev(button5, "data-visibility-attribute", "visible");
    			attr_dev(button5, "id", "animation06");
    			add_location(button5, file$5, 850, 8, 23650);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			append_dev(button0, div1);
    			append_dev(div1, img0);
    			append_dev(div1, t0);
    			append_dev(div1, img1);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(button0, t3);
    			if (if_block1) if_block1.m(button0, null);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, button1, anchor);
    			append_dev(button1, div3);
    			append_dev(div3, img2);
    			append_dev(div3, t5);
    			append_dev(div3, img3);
    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div3, t7);
    			if (if_block2) if_block2.m(div3, null);
    			append_dev(button1, t8);
    			if (if_block3) if_block3.m(button1, null);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);
    			append_dev(button2, div5);
    			append_dev(div5, img4);
    			append_dev(div5, t10);
    			append_dev(div5, img5);
    			append_dev(div5, t11);
    			append_dev(div5, div4);
    			append_dev(div5, t12);
    			if (if_block4) if_block4.m(div5, null);
    			append_dev(button2, t13);
    			if (if_block5) if_block5.m(button2, null);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, button3, anchor);
    			append_dev(button3, div7);
    			append_dev(div7, img6);
    			append_dev(div7, t15);
    			append_dev(div7, img7);
    			append_dev(div7, t16);
    			append_dev(div7, div6);
    			append_dev(div7, t17);
    			if (if_block6) if_block6.m(div7, null);
    			append_dev(button3, t18);
    			if (if_block7) if_block7.m(button3, null);
    			insert_dev(target, t19, anchor);
    			insert_dev(target, button4, anchor);
    			append_dev(button4, div9);
    			append_dev(div9, img8);
    			append_dev(div9, t20);
    			append_dev(div9, img9);
    			append_dev(div9, t21);
    			append_dev(div9, div8);
    			append_dev(div9, t22);
    			if (if_block8) if_block8.m(div9, null);
    			append_dev(button4, t23);
    			if (if_block9) if_block9.m(button4, null);
    			insert_dev(target, t24, anchor);
    			insert_dev(target, button5, anchor);
    			append_dev(button5, div11);
    			append_dev(div11, img10);
    			append_dev(div11, t25);
    			append_dev(div11, img11);
    			append_dev(div11, t26);
    			append_dev(div11, div10);
    			append_dev(div11, t27);
    			if (if_block10) if_block10.m(div11, null);
    			append_dev(button5, t28);
    			if (if_block11) if_block11.m(button5, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*click_handler*/ ctx[21], false, false, false),
    					listen_dev(div1, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div1, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false),
    					listen_dev(div3, "click", /*click_handler_1*/ ctx[22], false, false, false),
    					listen_dev(div3, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div3, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false),
    					listen_dev(div5, "click", /*click_handler_2*/ ctx[23], false, false, false),
    					listen_dev(div5, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div5, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false),
    					listen_dev(div7, "click", /*click_handler_3*/ ctx[24], false, false, false),
    					listen_dev(div7, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div7, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false),
    					listen_dev(div9, "click", /*click_handler_4*/ ctx[25], false, false, false),
    					listen_dev(div9, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div9, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false),
    					listen_dev(div11, "click", /*click_handler_5*/ ctx[26], false, false, false),
    					listen_dev(div11, "mouseenter", /*hoverHandler*/ ctx[19], false, false, false),
    					listen_dev(div11, "mouseleave", /*rollOutHandler*/ ctx[20], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img0.src !== (img0_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img1.src !== (img1_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img1, "src", img1_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 0)) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_12(ctx);
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_11(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(button0, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img2.src !== (img2_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img2, "src", img2_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img3.src !== (img3_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img3, "src", img3_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 1)) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_10(ctx);
    					if_block2.c();
    					if_block2.m(div3, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 1) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_9(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(button1, null);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img4.src !== (img4_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img4, "src", img4_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img5.src !== (img5_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img5, "src", img5_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 2)) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_8(ctx);
    					if_block4.c();
    					if_block4.m(div5, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 2) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block5, 1);
    					}
    				} else {
    					if_block5 = create_if_block_7(ctx);
    					if_block5.c();
    					transition_in(if_block5, 1);
    					if_block5.m(button2, null);
    				}
    			} else if (if_block5) {
    				group_outros();

    				transition_out(if_block5, 1, 1, () => {
    					if_block5 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img6.src !== (img6_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img6, "src", img6_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img7.src !== (img7_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img7, "src", img7_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 3)) {
    				if (if_block6) {
    					if_block6.p(ctx, dirty);
    				} else {
    					if_block6 = create_if_block_6(ctx);
    					if_block6.c();
    					if_block6.m(div7, null);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 3) {
    				if (if_block7) {
    					if_block7.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block7, 1);
    					}
    				} else {
    					if_block7 = create_if_block_5(ctx);
    					if_block7.c();
    					transition_in(if_block7, 1);
    					if_block7.m(button3, null);
    				}
    			} else if (if_block7) {
    				group_outros();

    				transition_out(if_block7, 1, 1, () => {
    					if_block7 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img8.src !== (img8_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img8, "src", img8_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img9.src !== (img9_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img9, "src", img9_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 4)) {
    				if (if_block8) {
    					if_block8.p(ctx, dirty);
    				} else {
    					if_block8 = create_if_block_4(ctx);
    					if_block8.c();
    					if_block8.m(div9, null);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 4) {
    				if (if_block9) {
    					if_block9.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block9, 1);
    					}
    				} else {
    					if_block9 = create_if_block_3(ctx);
    					if_block9.c();
    					transition_in(if_block9, 1);
    					if_block9.m(button4, null);
    				}
    			} else if (if_block9) {
    				group_outros();

    				transition_out(if_block9, 1, 1, () => {
    					if_block9 = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*blueCheckmark*/ 256 && img10.src !== (img10_src_value = /*blueCheckmark*/ ctx[8])) {
    				attr_dev(img10, "src", img10_src_value);
    			}

    			if (!current || dirty[0] & /*checkmark*/ 128 && img11.src !== (img11_src_value = /*checkmark*/ ctx[7])) {
    				attr_dev(img11, "src", img11_src_value);
    			}

    			if (!(/*id*/ ctx[13] == 5)) {
    				if (if_block10) {
    					if_block10.p(ctx, dirty);
    				} else {
    					if_block10 = create_if_block_2(ctx);
    					if_block10.c();
    					if_block10.m(div11, null);
    				}
    			} else if (if_block10) {
    				if_block10.d(1);
    				if_block10 = null;
    			}

    			if (/*showDescription*/ ctx[12] && /*id*/ ctx[13] == 5) {
    				if (if_block11) {
    					if_block11.p(ctx, dirty);

    					if (dirty[0] & /*showDescription, id*/ 12288) {
    						transition_in(if_block11, 1);
    					}
    				} else {
    					if_block11 = create_if_block_1(ctx);
    					if_block11.c();
    					transition_in(if_block11, 1);
    					if_block11.m(button5, null);
    				}
    			} else if (if_block11) {
    				group_outros();

    				transition_out(if_block11, 1, 1, () => {
    					if_block11 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block1);
    			transition_in(if_block3);
    			transition_in(if_block5);
    			transition_in(if_block7);
    			transition_in(if_block9);
    			transition_in(if_block11);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block1);
    			transition_out(if_block3);
    			transition_out(if_block5);
    			transition_out(if_block7);
    			transition_out(if_block9);
    			transition_out(if_block11);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(button1);
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(button3);
    			if (if_block6) if_block6.d();
    			if (if_block7) if_block7.d();
    			if (detaching) detach_dev(t19);
    			if (detaching) detach_dev(button4);
    			if (if_block8) if_block8.d();
    			if (if_block9) if_block9.d();
    			if (detaching) detach_dev(t24);
    			if (detaching) detach_dev(button5);
    			if (if_block10) if_block10.d();
    			if (if_block11) if_block11.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(619:6) {#if modelTime >= 1.5}",
    		ctx
    	});

    	return block;
    }

    // (644:12) {#if !(id == 0)}
    function create_if_block_12(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][0].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-copy svelte-11v3uqj");
    			add_location(div, file$5, 644, 14, 16146);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][0].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(644:12) {#if !(id == 0)}",
    		ctx
    	});

    	return block;
    }

    // (648:10) {#if showDescription && id == 0}
    function create_if_block_11(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "116px",
    				margin: "53px 0px 0px 42px",
    				rotate: "rotate(35deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][0].copy,
    				subtitle: /*hotspot*/ ctx[1][0].description,
    				thumbnail: /*hotspot*/ ctx[1][0].url.thumbnail,
    				margin: "-15px 0px 0px 160px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][0].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][0].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][0].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(648:10) {#if showDescription && id == 0}",
    		ctx
    	});

    	return block;
    }

    // (690:12) {#if !(id == 1)}
    function create_if_block_10(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][1].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-left svelte-11v3uqj");
    			add_location(div, file$5, 690, 14, 17794);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][1].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(690:12) {#if !(id == 1)}",
    		ctx
    	});

    	return block;
    }

    // (694:10) {#if showDescription && id == 1}
    function create_if_block_9(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "180px",
    				margin: "-53px 0px 0px -184px",
    				rotate: "rotate(30deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][1].copy,
    				subtitle: /*hotspot*/ ctx[1][1].description,
    				thumbnail: /*hotspot*/ ctx[1][1].url.thumbnail,
    				margin: "-122px 0px 0px -409px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				rightAligned: "true",
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][1].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][1].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][1].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(694:10) {#if showDescription && id == 1}",
    		ctx
    	});

    	return block;
    }

    // (736:12) {#if !(id == 2)}
    function create_if_block_8(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][2].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-copy svelte-11v3uqj");
    			add_location(div, file$5, 736, 14, 19482);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][2].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(736:12) {#if !(id == 2)}",
    		ctx
    	});

    	return block;
    }

    // (740:10) {#if showDescription && id == 2}
    function create_if_block_7(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "145px",
    				margin: "-77px 0px 0px -7px",
    				rotate: "rotate(-67deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][2].copy,
    				subtitle: /*hotspot*/ ctx[1][2].description,
    				thumbnail: /*hotspot*/ ctx[1][2].url.thumbnail,
    				margin: "-233px 0px 0px 110px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][2].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][2].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][2].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(740:10) {#if showDescription && id == 2}",
    		ctx
    	});

    	return block;
    }

    // (782:12) {#if !(id == 3)}
    function create_if_block_6(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][3].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-left svelte-11v3uqj");
    			add_location(div, file$5, 782, 14, 21129);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][3].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(782:12) {#if !(id == 3)}",
    		ctx
    	});

    	return block;
    }

    // (786:10) {#if showDescription && id == 3}
    function create_if_block_5(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "130px",
    				margin: "-40px 20px 0px 34px",
    				rotate: "rotate(-36deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][3].copy,
    				subtitle: /*hotspot*/ ctx[1][3].description,
    				thumbnail: /*hotspot*/ ctx[1][3].url.thumbnail,
    				margin: "-217px 0px 0px 170px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][3].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][3].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][3].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(786:10) {#if showDescription && id == 3}",
    		ctx
    	});

    	return block;
    }

    // (827:12) {#if !(id == 4)}
    function create_if_block_4(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][4].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-left svelte-11v3uqj");
    			add_location(div, file$5, 827, 14, 22793);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][4].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(827:12) {#if !(id == 4)}",
    		ctx
    	});

    	return block;
    }

    // (831:10) {#if showDescription && id == 4}
    function create_if_block_3(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "54px",
    				margin: "-22px 0px 0px -56px",
    				rotate: "rotate(41deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][4].copy,
    				subtitle: /*hotspot*/ ctx[1][4].description,
    				thumbnail: /*hotspot*/ ctx[1][4].url.thumbnail,
    				margin: "-204px 0px 0px -285px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				rightAligned: "true",
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][4].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][4].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][4].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(831:10) {#if showDescription && id == 4}",
    		ctx
    	});

    	return block;
    }

    // (873:12) {#if !(id == 5)}
    function create_if_block_2(ctx) {
    	let div;
    	let t_value = /*hotspot*/ ctx[1][5].copy + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "hotspot-left svelte-11v3uqj");
    			add_location(div, file$5, 873, 14, 24491);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*hotspot*/ 2 && t_value !== (t_value = /*hotspot*/ ctx[1][5].copy + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(873:12) {#if !(id == 5)}",
    		ctx
    	});

    	return block;
    }

    // (877:10) {#if showDescription && id == 5}
    function create_if_block_1(ctx) {
    	let hotspotconnectionline;
    	let t;
    	let hotspotdescription;
    	let current;

    	hotspotconnectionline = new HotspotConnectionLine({
    			props: {
    				width: "153px",
    				margin: "-27px 0px 0px -157px",
    				rotate: "rotate(25deg)"
    			},
    			$$inline: true
    		});

    	hotspotdescription = new HotspotDescription({
    			props: {
    				title: /*hotspot*/ ctx[1][5].copy,
    				subtitle: /*hotspot*/ ctx[1][5].description,
    				thumbnail: /*hotspot*/ ctx[1][5].url.thumbnail,
    				margin: "-266px 0px 0px -394px",
    				backCopy: /*backCopy*/ ctx[2],
    				backArrowIcon: /*backArrow*/ ctx[3],
    				model: /*modelViewer*/ ctx[0],
    				rightAligned: "true",
    				selectedCheckmark: /*blueCheckmark*/ ctx[8]
    			},
    			$$inline: true
    		});

    	hotspotdescription.$on("close", /*closeDescriptionHandler*/ ctx[18]);
    	hotspotdescription.$on("open-video", /*openVideoHandler*/ ctx[16]);

    	const block = {
    		c: function create() {
    			create_component(hotspotconnectionline.$$.fragment);
    			t = space();
    			create_component(hotspotdescription.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(hotspotconnectionline, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(hotspotdescription, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const hotspotdescription_changes = {};
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.title = /*hotspot*/ ctx[1][5].copy;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.subtitle = /*hotspot*/ ctx[1][5].description;
    			if (dirty[0] & /*hotspot*/ 2) hotspotdescription_changes.thumbnail = /*hotspot*/ ctx[1][5].url.thumbnail;
    			if (dirty[0] & /*backCopy*/ 4) hotspotdescription_changes.backCopy = /*backCopy*/ ctx[2];
    			if (dirty[0] & /*backArrow*/ 8) hotspotdescription_changes.backArrowIcon = /*backArrow*/ ctx[3];
    			if (dirty[0] & /*modelViewer*/ 1) hotspotdescription_changes.model = /*modelViewer*/ ctx[0];
    			if (dirty[0] & /*blueCheckmark*/ 256) hotspotdescription_changes.selectedCheckmark = /*blueCheckmark*/ ctx[8];
    			hotspotdescription.$set(hotspotdescription_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hotspotconnectionline.$$.fragment, local);
    			transition_in(hotspotdescription.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hotspotconnectionline.$$.fragment, local);
    			transition_out(hotspotdescription.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(hotspotconnectionline, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(hotspotdescription, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(877:10) {#if showDescription && id == 5}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let div1;
    	let div0;
    	let model_viewer;
    	let model_viewer_src_value;
    	let t0;
    	let div4;
    	let div3;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let div2;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*modelTime*/ ctx[14] >= 1.5 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			model_viewer = element("model-viewer");
    			if (if_block) if_block.c();
    			t0 = space();
    			div4 = element("div");
    			div3 = element("div");
    			img0 = element("img");
    			t1 = space();
    			div2 = element("div");
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			set_custom_element_data(model_viewer, "id", "unit01");
    			if (model_viewer.src !== (model_viewer_src_value = /*model*/ ctx[4])) set_custom_element_data(model_viewer, "src", model_viewer_src_value);
    			set_custom_element_data(model_viewer, "class", "model svelte-11v3uqj");
    			set_custom_element_data(model_viewer, "environment-image", /*lights*/ ctx[5]);
    			set_custom_element_data(model_viewer, "shadow-color", "#ff0066");
    			set_custom_element_data(model_viewer, "alt", "Evo Laptop");
    			set_custom_element_data(model_viewer, "loading", "lazy");
    			set_custom_element_data(model_viewer, "exposure", "0.9");
    			set_custom_element_data(model_viewer, "auto-rotate", "true");
    			set_custom_element_data(model_viewer, "camera-controls", "");
    			set_custom_element_data(model_viewer, "autoplay", "true");
    			set_custom_element_data(model_viewer, "modelisvisible", "");
    			set_custom_element_data(model_viewer, "field-of-view", "40deg");
    			set_custom_element_data(model_viewer, "interaction-prompt", "none");
    			set_custom_element_data(model_viewer, "auto-rotate-delay", "5000");
    			set_custom_element_data(model_viewer, "camera-orbit", "330deg 78deg 160m");
    			set_custom_element_data(model_viewer, "camera-target", "0m 27.5m 0m");
    			set_custom_element_data(model_viewer, "rotation-per-second", "15%");
    			add_location(model_viewer, file$5, 598, 4, 14716);
    			attr_dev(div0, "class", "ModeViewerHolder svelte-11v3uqj");
    			set_style(div0, "visibility", "hidden");
    			set_style(div0, "background", "url(" + /*background*/ ctx[6] + ") no-repeat");
    			add_location(div0, file$5, 595, 2, 14605);
    			attr_dev(div1, "id", "pageWrapper");
    			set_style(div1, "visibility", "hidden");
    			attr_dev(div1, "class", "svelte-11v3uqj");
    			add_location(div1, file$5, 594, 0, 14552);
    			attr_dev(img0, "id", "shadow");
    			if (img0.src !== (img0_src_value = /*zoomifyGlassShadow*/ ctx[11])) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "zoomifyShadow");
    			attr_dev(img0, "class", "svelte-11v3uqj");
    			add_location(img0, file$5, 905, 4, 25501);
    			attr_dev(img1, "id", "EV_Inmersive");
    			if (img1.src !== (img1_src_value = /*landscapeImg*/ ctx[10])) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "EV_Inmersive");
    			attr_dev(img1, "class", "svelte-11v3uqj");
    			add_location(img1, file$5, 907, 6, 25606);
    			attr_dev(div2, "id", "InmersiveContainer");
    			attr_dev(div2, "class", "svelte-11v3uqj");
    			add_location(div2, file$5, 906, 4, 25570);
    			attr_dev(img2, "id", "EV_lens");
    			if (img2.src !== (img2_src_value = /*zoomifyGlass*/ ctx[9])) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "EV_lens");
    			attr_dev(img2, "class", "svelte-11v3uqj");
    			add_location(img2, file$5, 909, 4, 25685);
    			attr_dev(div3, "id", "glassContainer");
    			attr_dev(div3, "class", "svelte-11v3uqj");
    			add_location(div3, file$5, 904, 2, 25471);
    			attr_dev(div4, "id", "animZoom");
    			attr_dev(div4, "class", "noMouseInteraction overlaysFXs svelte-11v3uqj");
    			attr_dev(div4, "data-visibility-attribute", "visible");
    			add_location(div4, file$5, 900, 0, 25368);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, model_viewer);
    			if (if_block) if_block.m(model_viewer, null);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, img0);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			append_dev(div2, img1);
    			append_dev(div3, t2);
    			append_dev(div3, img2);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(model_viewer, "model-visibility", /*isVisible*/ ctx[15], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*modelTime*/ ctx[14] >= 1.5) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*modelTime*/ 16384) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(model_viewer, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty[0] & /*model*/ 16 && model_viewer.src !== (model_viewer_src_value = /*model*/ ctx[4])) {
    				set_custom_element_data(model_viewer, "src", model_viewer_src_value);
    			}

    			if (!current || dirty[0] & /*lights*/ 32) {
    				set_custom_element_data(model_viewer, "environment-image", /*lights*/ ctx[5]);
    			}

    			if (!current || dirty[0] & /*background*/ 64) {
    				set_style(div0, "background", "url(" + /*background*/ ctx[6] + ") no-repeat");
    			}

    			if (!current || dirty[0] & /*zoomifyGlassShadow*/ 2048 && img0.src !== (img0_src_value = /*zoomifyGlassShadow*/ ctx[11])) {
    				attr_dev(img0, "src", img0_src_value);
    			}

    			if (!current || dirty[0] & /*landscapeImg*/ 1024 && img1.src !== (img1_src_value = /*landscapeImg*/ ctx[10])) {
    				attr_dev(img1, "src", img1_src_value);
    			}

    			if (!current || dirty[0] & /*zoomifyGlass*/ 512 && img2.src !== (img2_src_value = /*zoomifyGlass*/ ctx[9])) {
    				attr_dev(img2, "src", img2_src_value);
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
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div4);
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

    function showAll() {
    	let animation01 = document.getElementById("animation01");
    	let animation02 = document.getElementById("animation02");
    	let animation03 = document.getElementById("animation03");
    	let animation04 = document.getElementById("animation04");
    	let animation05 = document.getElementById("animation05");
    	let animation06 = document.getElementById("animation06");
    	animation01.setAttribute("data-visible", "");
    	animation02.setAttribute("data-visible", "");
    	animation03.setAttribute("data-visible", "");
    	animation04.setAttribute("data-visible", "");
    	animation05.setAttribute("data-visible", "");
    	animation06.setAttribute("data-visible", "");
    	animation01.setAttribute("style", "display:visible;");
    	animation02.setAttribute("style", "display:visible;");
    	animation03.setAttribute("style", "display:visible;");
    	animation04.setAttribute("style", "display:visible;");
    	animation05.setAttribute("style", "display:visible;");
    	animation06.setAttribute("style", "display:visible;");
    	let allBluecheckmark = document.getElementsByClassName("blue-checkmark");
    	let allcheckmark = document.getElementsByClassName("white-checkmark");

    	for (var i = 0, len = allBluecheckmark.length; i < len; i++) {
    		allBluecheckmark[i].style.opacity = 0;
    		allcheckmark[i].style.opacity = 1;
    	}
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Model", slots, []);
    	let { modelViewer = "" } = $$props;
    	let { hotspot = "" } = $$props;
    	let { backCopy = "" } = $$props;
    	let { backArrow = "" } = $$props;
    	let { model = "" } = $$props;
    	let { lights = "" } = $$props;
    	let { background = "" } = $$props;
    	let { checkmark = "" } = $$props;
    	let { blueCheckmark = "" } = $$props;
    	let { zoomifyGlass = "" } = $$props;
    	let { landscapeImg = "" } = $$props;
    	let { zoomifyGlassShadow = "" } = $$props;
    	let zoomScreenTL = new TimelineMax();
    	let hotspotHoverTL = new TimelineMax();
    	let hotspotRolloutTL = new TimelineMax();
    	let showDescription = false;
    	let id = -1;
    	let modelTime = 0;
    	const dispatch = createEventDispatcher();

    	function isVisible() {
    		dispatch("isVisible", true);
    	}

    	function openVideoHandler() {
    		dispatch("open-video", { active: true, actualId: id });
    	}

    	function showDescriptionHandler(elementId) {
    		$$invalidate(12, showDescription = true);
    		$$invalidate(13, id = elementId);
    		clickHS(elementId);
    	}

    	function closeDescriptionHandler() {
    		$$invalidate(13, id = -1);
    		$$invalidate(12, showDescription = false);
    		clickHS(id);
    	}

    	function clearAnimationHandler() {
    		zoomScreenTL.pause("reset");
    	}

    	function animationZoomifyGlass() {
    		zoomScreenTL = new TimelineMax();

    		zoomScreenTL.add("reset").from(
    			glassContainer,
    			0.3,
    			{
    				force3D: true,
    				z: 0.01,
    				opacity: 0,
    				scaleX: 0,
    				scaleY: 0,
    				y: "120"
    			},
    			0.3
    		).to(glassContainer, 0.3, { force3D: true, scaleX: 1.2, scaleY: 1.2 }, 0.3).to(
    			glassContainer,
    			0.3,
    			{
    				force3D: true,
    				z: 0.01,
    				opacity: 1,
    				scaleX: 1,
    				scaleY: 1,
    				y: "0"
    			},
    			0.4
    		).add("slide").to(glassContainer, 4, { x: "-60" }, "slide").to(EV_Inmersive, 4, { x: "80" }, "slide");
    	}

    	function hoverHandler() {
    		this.lastChild.style.color = "#ffffff";
    		hotspotHoverTL = new TimelineMax();
    		hotspotHoverTL.add("init").to(this.getElementsByClassName("blue-checkmark"), 0.2, { opacity: 1, scale: 1.2 }, "init").to(this.getElementsByClassName("white-checkmark"), 0.5, { opacity: 0, scale: 1, ease: Expo.easeOut }, "init");

    		if (this.lastChild.classList.contains("hotspot-copy")) {
    			hotspotHoverTL.to(
    				this.lastChild,
    				0.3,
    				{
    					background: "linear-gradient(90deg, rgba(0,0,0, 0.15) 0%, rgba(0,0,0,1) 90%)"
    				},
    				"init"
    			);
    		} else {
    			hotspotHoverTL.to(
    				this.lastChild,
    				0.3,
    				{
    					background: "linear-gradient(90deg, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 0.15) 100%)"
    				},
    				"init"
    			);
    		}
    	}

    	function rollOutHandler() {
    		if (this.lastChild.style) this.lastChild.style.color = "#dddddd";
    		hotspotRolloutTL = new TimelineMax();

    		hotspotRolloutTL.add("init").to(this.getElementsByClassName("white-checkmark"), 0.2, { opacity: 1, scale: 1 }, "init").to(
    			this.getElementsByClassName("blue-checkmark"),
    			0.5,
    			{
    				opacity: 0,
    				scale: 1.2,
    				ease: Expo.easeOut
    			},
    			"init"
    		);

    		if (this.lastChild.classList && this.lastChild.classList.contains("hotspot-copy")) {
    			hotspotRolloutTL.to(
    				this.lastChild,
    				0.3,
    				{
    					background: "linear-gradient(90deg, rgba(0, 0, 0, 0) 2%, rgba(0, 0, 0, 0.5) 40%)"
    				},
    				"init"
    			);
    		} else {
    			hotspotRolloutTL.to(
    				this.lastChild,
    				0.3,
    				{
    					background: "linear-gradient(90deg, #000000 0%, rgba(0, 0, 0, 0.2) 100%"
    				},
    				"init"
    			);
    		}
    	}

    	function playRange(start, time) {
    		let animationPause;
    		modelViewer.play();
    		$$invalidate(0, modelViewer.currentTime = start, modelViewer);

    		animationPause = setTimeout(
    			function () {
    				modelViewer.pause();
    				open = false;
    			},
    			time
    		);
    	}

    	function clickHS(el) {
    		// .style.cursor = "pointer";
    		let animation01 = document.getElementById("animation01");

    		let animation02 = document.getElementById("animation02");
    		let animation03 = document.getElementById("animation03");
    		let animation04 = document.getElementById("animation04");
    		let animation05 = document.getElementById("animation05");
    		let animation06 = document.getElementById("animation06");
    		clearAnimationHandler();
    		showAll();
    		modelViewer.resetTurntableRotation();
    		$$invalidate(0, modelViewer.autoRotate = false, modelViewer);
    		$$invalidate(0, modelViewer.cameraControls = false, modelViewer);
    		$$invalidate(0, modelViewer.fieldOfView = "40deg", modelViewer);
    		$$invalidate(0, modelViewer.cameraTarget = "0m 25m 0m", modelViewer);

    		switch (el) {
    			case 0:
    				//Awake in a flash
    				$$invalidate(0, modelViewer.cameraTarget = "20m 15m -20m", modelViewer);
    				$$invalidate(0, modelViewer.cameraOrbit = "30deg 78deg 180m", modelViewer);
    				playRange(19, 2000);
    				animation02.setAttribute("style", "display:none;");
    				break;
    			case 1:
    				//Immersive viewing
    				$$invalidate(0, modelViewer.cameraOrbit = "5deg 80deg 160m", modelViewer);
    				$$invalidate(0, modelViewer.cameraTarget = "0m 30m 0m", modelViewer);
    				animationZoomifyGlass();
    				playRange(7, 2000);
    				animation01.setAttribute("style", "display:none;");
    				animation05.setAttribute("style", "display:none;");
    				break;
    			case 2:
    				//Get thing done fast 
    				$$invalidate(0, modelViewer.cameraOrbit = "00deg 10deg 160m", modelViewer);
    				$$invalidate(0, modelViewer.cameraTarget = "0m 50m 0m", modelViewer);
    				animation01.setAttribute("style", "display:none;");
    				animation02.setAttribute("style", "display:none;");
    				playRange(13, 2000);
    				break;
    			case 3:
    				//Unplug for longer
    				$$invalidate(0, modelViewer.cameraOrbit = "00deg 85deg 160m", modelViewer);
    				$$invalidate(0, modelViewer.cameraTarget = "20m 15m -20m", modelViewer);
    				animation03.setAttribute("style", "display:none;");
    				playRange(2, 100);
    				break;
    			case 4:
    				//Fast, realible connections
    				$$invalidate(0, modelViewer.cameraOrbit = "340deg 80deg 160m", modelViewer);
    				animation01.setAttribute("style", "display:none;");
    				animation02.setAttribute("style", "display:none;");
    				animation03.setAttribute("style", "display:none;");
    				playRange(23, 2000);
    				break;
    			case 5:
    				//Universal cable connectivity
    				playRange(2, 100);
    				$$invalidate(0, modelViewer.cameraOrbit = "300deg 75deg 160m", modelViewer);
    				$$invalidate(0, modelViewer.cameraTarget = "0m 20m -20m", modelViewer);
    				animation03.setAttribute("style", "display:none;");
    				animation05.setAttribute("style", "display:none;");
    				break;
    			default:
    				console.log("default");
    				$$invalidate(0, modelViewer.cameraOrbit = "330deg 78deg 160m", modelViewer);
    				$$invalidate(0, modelViewer.cameraTarget = "0m 27.5m 0m", modelViewer);
    				$$invalidate(0, modelViewer.autoRotate = true, modelViewer);
    				$$invalidate(0, modelViewer.cameraControls = true, modelViewer);
    				playRange(2, 100);
    		}
    	}

    	(() => {
    		let interval = self.setInterval(
    			() => {
    				$$invalidate(14, modelTime = modelViewer.currentTime);

    				if (modelViewer.currentTime >= 2) {
    					modelViewer.pause();
    					clearInterval(interval);
    				}
    			},
    			100
    		);
    	})();

    	const writable_props = [
    		"modelViewer",
    		"hotspot",
    		"backCopy",
    		"backArrow",
    		"model",
    		"lights",
    		"background",
    		"checkmark",
    		"blueCheckmark",
    		"zoomifyGlass",
    		"landscapeImg",
    		"zoomifyGlassShadow"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Model> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => showDescriptionHandler(0);
    	const click_handler_1 = () => showDescriptionHandler(1);
    	const click_handler_2 = () => showDescriptionHandler(2);
    	const click_handler_3 = () => showDescriptionHandler(3);
    	const click_handler_4 = () => showDescriptionHandler(4);
    	const click_handler_5 = () => showDescriptionHandler(5);

    	$$self.$$set = $$props => {
    		if ("modelViewer" in $$props) $$invalidate(0, modelViewer = $$props.modelViewer);
    		if ("hotspot" in $$props) $$invalidate(1, hotspot = $$props.hotspot);
    		if ("backCopy" in $$props) $$invalidate(2, backCopy = $$props.backCopy);
    		if ("backArrow" in $$props) $$invalidate(3, backArrow = $$props.backArrow);
    		if ("model" in $$props) $$invalidate(4, model = $$props.model);
    		if ("lights" in $$props) $$invalidate(5, lights = $$props.lights);
    		if ("background" in $$props) $$invalidate(6, background = $$props.background);
    		if ("checkmark" in $$props) $$invalidate(7, checkmark = $$props.checkmark);
    		if ("blueCheckmark" in $$props) $$invalidate(8, blueCheckmark = $$props.blueCheckmark);
    		if ("zoomifyGlass" in $$props) $$invalidate(9, zoomifyGlass = $$props.zoomifyGlass);
    		if ("landscapeImg" in $$props) $$invalidate(10, landscapeImg = $$props.landscapeImg);
    		if ("zoomifyGlassShadow" in $$props) $$invalidate(11, zoomifyGlassShadow = $$props.zoomifyGlassShadow);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		HotspotDescription,
    		HotspotConnectionLine,
    		modelViewer,
    		hotspot,
    		backCopy,
    		backArrow,
    		model,
    		lights,
    		background,
    		checkmark,
    		blueCheckmark,
    		zoomifyGlass,
    		landscapeImg,
    		zoomifyGlassShadow,
    		zoomScreenTL,
    		hotspotHoverTL,
    		hotspotRolloutTL,
    		showDescription,
    		id,
    		modelTime,
    		dispatch,
    		isVisible,
    		openVideoHandler,
    		showDescriptionHandler,
    		closeDescriptionHandler,
    		clearAnimationHandler,
    		animationZoomifyGlass,
    		showAll,
    		hoverHandler,
    		rollOutHandler,
    		playRange,
    		clickHS
    	});

    	$$self.$inject_state = $$props => {
    		if ("modelViewer" in $$props) $$invalidate(0, modelViewer = $$props.modelViewer);
    		if ("hotspot" in $$props) $$invalidate(1, hotspot = $$props.hotspot);
    		if ("backCopy" in $$props) $$invalidate(2, backCopy = $$props.backCopy);
    		if ("backArrow" in $$props) $$invalidate(3, backArrow = $$props.backArrow);
    		if ("model" in $$props) $$invalidate(4, model = $$props.model);
    		if ("lights" in $$props) $$invalidate(5, lights = $$props.lights);
    		if ("background" in $$props) $$invalidate(6, background = $$props.background);
    		if ("checkmark" in $$props) $$invalidate(7, checkmark = $$props.checkmark);
    		if ("blueCheckmark" in $$props) $$invalidate(8, blueCheckmark = $$props.blueCheckmark);
    		if ("zoomifyGlass" in $$props) $$invalidate(9, zoomifyGlass = $$props.zoomifyGlass);
    		if ("landscapeImg" in $$props) $$invalidate(10, landscapeImg = $$props.landscapeImg);
    		if ("zoomifyGlassShadow" in $$props) $$invalidate(11, zoomifyGlassShadow = $$props.zoomifyGlassShadow);
    		if ("zoomScreenTL" in $$props) zoomScreenTL = $$props.zoomScreenTL;
    		if ("hotspotHoverTL" in $$props) hotspotHoverTL = $$props.hotspotHoverTL;
    		if ("hotspotRolloutTL" in $$props) hotspotRolloutTL = $$props.hotspotRolloutTL;
    		if ("showDescription" in $$props) $$invalidate(12, showDescription = $$props.showDescription);
    		if ("id" in $$props) $$invalidate(13, id = $$props.id);
    		if ("modelTime" in $$props) $$invalidate(14, modelTime = $$props.modelTime);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		modelViewer,
    		hotspot,
    		backCopy,
    		backArrow,
    		model,
    		lights,
    		background,
    		checkmark,
    		blueCheckmark,
    		zoomifyGlass,
    		landscapeImg,
    		zoomifyGlassShadow,
    		showDescription,
    		id,
    		modelTime,
    		isVisible,
    		openVideoHandler,
    		showDescriptionHandler,
    		closeDescriptionHandler,
    		hoverHandler,
    		rollOutHandler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class Model extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$5,
    			create_fragment$5,
    			safe_not_equal,
    			{
    				modelViewer: 0,
    				hotspot: 1,
    				backCopy: 2,
    				backArrow: 3,
    				model: 4,
    				lights: 5,
    				background: 6,
    				checkmark: 7,
    				blueCheckmark: 8,
    				zoomifyGlass: 9,
    				landscapeImg: 10,
    				zoomifyGlassShadow: 11
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Model",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get modelViewer() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set modelViewer(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get hotspot() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hotspot(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backCopy() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backCopy(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get backArrow() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set backArrow(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get model() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set model(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lights() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lights(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get background() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set background(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get checkmark() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set checkmark(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get blueCheckmark() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set blueCheckmark(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get zoomifyGlass() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set zoomifyGlass(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get landscapeImg() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set landscapeImg(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get zoomifyGlassShadow() {
    		throw new Error("<Model>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set zoomifyGlassShadow(value) {
    		throw new Error("<Model>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/custom/LoadingScreen.svelte generated by Svelte v3.29.0 */

    const file$6 = "src/components/custom/LoadingScreen.svelte";

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "loader-animation svelte-15pk297");
    			set_style(div0, "background", "url(" + /*loader*/ ctx[0] + ")");
    			add_location(div0, file$6, 25, 2, 421);
    			attr_dev(div1, "class", "loader svelte-15pk297");
    			add_location(div1, file$6, 24, 0, 398);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { loader: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LoadingScreen",
    			options,
    			id: create_fragment$6.name
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

    /* src/components/VideoPlayer.svelte generated by Svelte v3.29.0 */
    const file$7 = "src/components/VideoPlayer.svelte";

    function create_fragment$7(ctx) {
    	let div3;
    	let div2;
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
    			div3 = element("div");
    			div2 = element("div");
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
    			add_location(img, file$7, 43, 8, 912);
    			attr_dev(div0, "class", "exit close-video svelte-1korbiu");
    			add_location(div0, file$7, 42, 6, 857);
    			attr_dev(div1, "class", "close-container svelte-1korbiu");
    			add_location(div1, file$7, 41, 4, 821);
    			set_custom_element_data(video_js, "autoplay", "");
    			set_custom_element_data(video_js, "data-account", /*videoAccount*/ ctx[0]);
    			set_custom_element_data(video_js, "data-player", "default");
    			set_custom_element_data(video_js, "data-embed", "default");
    			set_custom_element_data(video_js, "controls", "");
    			set_custom_element_data(video_js, "data-video-id", /*videoId*/ ctx[1]);
    			set_custom_element_data(video_js, "data-playlist-id", "");
    			set_custom_element_data(video_js, "data-application-id", "");
    			set_custom_element_data(video_js, "class", "vjs-fluid");
    			add_location(video_js, file$7, 46, 4, 988);
    			if (script.src !== (script_src_value = "https://players.brightcove.net/5226411160001/default_default/index.min.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$7, 56, 4, 1236);
    			attr_dev(div2, "class", "video svelte-1korbiu");
    			add_location(div2, file$7, 40, 2, 797);
    			attr_dev(div3, "class", "video-holder svelte-1korbiu");
    			add_location(div3, file$7, 39, 0, 768);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div2, t0);
    			append_dev(div2, video_js);
    			append_dev(div2, t1);
    			append_dev(div2, script);

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*exit*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*exitButton*/ 4 && img.src !== (img_src_value = /*exitButton*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*videoAccount*/ 1) {
    				set_custom_element_data(video_js, "data-account", /*videoAccount*/ ctx[0]);
    			}

    			if (dirty & /*videoId*/ 2) {
    				set_custom_element_data(video_js, "data-video-id", /*videoId*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			dispose();
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
    	validate_slots("VideoPlayer", slots, []);
    	let { videoAccount = "" } = $$props;
    	let { videoId = "" } = $$props;
    	let { exitButton = "" } = $$props;
    	const dispatch = createEventDispatcher();

    	function exit() {
    		dispatch("close-video", false);
    	}

    	const writable_props = ["videoAccount", "videoId", "exitButton"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<VideoPlayer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("videoAccount" in $$props) $$invalidate(0, videoAccount = $$props.videoAccount);
    		if ("videoId" in $$props) $$invalidate(1, videoId = $$props.videoId);
    		if ("exitButton" in $$props) $$invalidate(2, exitButton = $$props.exitButton);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		videoAccount,
    		videoId,
    		exitButton,
    		dispatch,
    		exit
    	});

    	$$self.$inject_state = $$props => {
    		if ("videoAccount" in $$props) $$invalidate(0, videoAccount = $$props.videoAccount);
    		if ("videoId" in $$props) $$invalidate(1, videoId = $$props.videoId);
    		if ("exitButton" in $$props) $$invalidate(2, exitButton = $$props.exitButton);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [videoAccount, videoId, exitButton, exit];
    }

    class VideoPlayer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			videoAccount: 0,
    			videoId: 1,
    			exitButton: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VideoPlayer",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get videoAccount() {
    		throw new Error("<VideoPlayer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set videoAccount(value) {
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

    /* src/components/custom/BlurryScreen.svelte generated by Svelte v3.29.0 */

    const file$8 = "src/components/custom/BlurryScreen.svelte";

    function create_fragment$8(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "blurry-screen svelte-mbg3m4");
    			add_location(div, file$8, 14, 0, 279);
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
    			add_location(img, file$9, 47, 8, 1081);
    			attr_dev(div0, "class", "exit svelte-6971wb");
    			add_location(div0, file$9, 46, 6, 1032);
    			attr_dev(div1, "class", "close-container svelte-6971wb");
    			add_location(div1, file$9, 45, 4, 996);
    			attr_dev(div2, "class", "text-container svelte-6971wb");
    			add_location(div2, file$9, 50, 4, 1157);
    			attr_dev(div3, "class", "legal svelte-6971wb");
    			add_location(div3, file$9, 44, 2, 972);
    			attr_dev(div4, "class", "legal-container svelte-6971wb");
    			add_location(div4, file$9, 43, 0, 940);
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

    /* src/App.svelte generated by Svelte v3.29.0 */

    const { document: document_1 } = globals;
    const file$a = "src/App.svelte";

    // (105:2) {#if !isModelVisible}
    function create_if_block_3$1(ctx) {
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
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(105:2) {#if !isModelVisible}",
    		ctx
    	});

    	return block;
    }

    // (108:2) {#if showBlurryScreen}
    function create_if_block_2$1(ctx) {
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
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(108:2) {#if showBlurryScreen}",
    		ctx
    	});

    	return block;
    }

    // (111:2) {#if openLegal}
    function create_if_block_1$1(ctx) {
    	let legal;
    	let current;

    	legal = new Legal({
    			props: {
    				copy: /*content*/ ctx[0].footer.legal.description,
    				exitButton: /*content*/ ctx[0].assets.exit_button
    			},
    			$$inline: true
    		});

    	legal.$on("close-modal", /*closeModalHandler*/ ctx[12]);

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
    			if (dirty & /*content*/ 1) legal_changes.copy = /*content*/ ctx[0].footer.legal.description;
    			if (dirty & /*content*/ 1) legal_changes.exitButton = /*content*/ ctx[0].assets.exit_button;
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(111:2) {#if openLegal}",
    		ctx
    	});

    	return block;
    }

    // (136:2) {#if openVideo}
    function create_if_block$1(ctx) {
    	let blurryscreen;
    	let t;
    	let videoplayer;
    	let current;
    	blurryscreen = new BlurryScreen({ $$inline: true });

    	videoplayer = new VideoPlayer({
    			props: {
    				videoAccount: /*video*/ ctx[1][/*featureId*/ ctx[2]].data_account,
    				videoId: /*video*/ ctx[1][/*featureId*/ ctx[2]].video_id,
    				exitButton: /*content*/ ctx[0].assets.exit_button
    			},
    			$$inline: true
    		});

    	videoplayer.$on("close-video", /*closeVideoHandler*/ ctx[9]);

    	const block = {
    		c: function create() {
    			create_component(blurryscreen.$$.fragment);
    			t = space();
    			create_component(videoplayer.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(blurryscreen, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(videoplayer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const videoplayer_changes = {};
    			if (dirty & /*video, featureId*/ 6) videoplayer_changes.videoAccount = /*video*/ ctx[1][/*featureId*/ ctx[2]].data_account;
    			if (dirty & /*video, featureId*/ 6) videoplayer_changes.videoId = /*video*/ ctx[1][/*featureId*/ ctx[2]].video_id;
    			if (dirty & /*content*/ 1) videoplayer_changes.exitButton = /*content*/ ctx[0].assets.exit_button;
    			videoplayer.$set(videoplayer_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(blurryscreen.$$.fragment, local);
    			transition_in(videoplayer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(blurryscreen.$$.fragment, local);
    			transition_out(videoplayer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(blurryscreen, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(videoplayer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(136:2) {#if openVideo}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let script0;
    	let script0_src_value;
    	let script1;
    	let script1_src_value;
    	let script2;
    	let script2_src_value;
    	let script3;
    	let script3_src_value;
    	let t0;
    	let div;
    	let t1;
    	let t2;
    	let t3;
    	let header;
    	let t4;
    	let model;
    	let t5;
    	let t6;
    	let footer;
    	let current;
    	let if_block0 = !/*isModelVisible*/ ctx[4] && create_if_block_3$1(ctx);
    	let if_block1 = /*showBlurryScreen*/ ctx[7] && create_if_block_2$1(ctx);
    	let if_block2 = /*openLegal*/ ctx[6] && create_if_block_1$1(ctx);

    	header = new Header({
    			props: {
    				headline: /*content*/ ctx[0].header.headline,
    				subheadline: /*content*/ ctx[0].header.subheadline_desktop,
    				arrow: /*content*/ ctx[0].assets.down_arrow
    			},
    			$$inline: true
    		});

    	model = new Model({
    			props: {
    				modelViewer: /*modelViewer*/ ctx[3],
    				model: /*content*/ ctx[0].assets.model,
    				lights: /*content*/ ctx[0].assets.lights,
    				background: /*content*/ ctx[0].assets.background,
    				checkmark: /*content*/ ctx[0].assets.checkmark,
    				hotspot: /*content*/ ctx[0].hotspots,
    				blueCheckmark: /*content*/ ctx[0].assets.blue_checkmark,
    				backCopy: /*content*/ ctx[0].back_copy,
    				backArrow: /*content*/ ctx[0].assets.back_arrow,
    				zoomifyGlass: /*content*/ ctx[0].assets.zoomify_glass,
    				landscapeImg: /*content*/ ctx[0].assets.zoomify_glassFront,
    				zoomifyGlassShadow: /*content*/ ctx[0].assets.zoomify_glassBack
    			},
    			$$inline: true
    		});

    	model.$on("isVisible", /*isVisible*/ ctx[8]);
    	model.$on("open-video", /*openVideoHandler*/ ctx[10]);
    	let if_block3 = /*openVideo*/ ctx[5] && create_if_block$1(ctx);

    	footer = new Footer({
    			props: {
    				copy: /*content*/ ctx[0].footer,
    				logo: /*content*/ ctx[0].assets.evo_checkmark
    			},
    			$$inline: true
    		});

    	footer.$on("open-modal", /*openModalHandler*/ ctx[11]);

    	const block = {
    		c: function create() {
    			script0 = element("script");
    			script1 = element("script");
    			script2 = element("script");
    			script3 = element("script");
    			t0 = space();
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			if (if_block1) if_block1.c();
    			t2 = space();
    			if (if_block2) if_block2.c();
    			t3 = space();
    			create_component(header.$$.fragment);
    			t4 = space();
    			create_component(model.$$.fragment);
    			t5 = space();
    			if (if_block3) if_block3.c();
    			t6 = space();
    			create_component(footer.$$.fragment);
    			if (script0.src !== (script0_src_value = "https://unpkg.com/@webcomponents/webcomponentsjs@2.1.3/webcomponents-loader.js")) attr_dev(script0, "src", script0_src_value);
    			add_location(script0, file$a, 90, 2, 2199);
    			if (script1.src !== (script1_src_value = "https://unpkg.com/intersection-observer@0.5.1/intersection-observer.js")) attr_dev(script1, "src", script1_src_value);
    			add_location(script1, file$a, 93, 2, 2311);
    			if (script2.src !== (script2_src_value = "https://unpkg.com/resize-observer-polyfill@1.5.1/dist/ResizeObserver.js")) attr_dev(script2, "src", script2_src_value);
    			add_location(script2, file$a, 96, 2, 2415);
    			if (script3.src !== (script3_src_value = "https://unpkg.com/focus-visible@5.1.0/dist/focus-visible.js")) attr_dev(script3, "src", script3_src_value);
    			add_location(script3, file$a, 99, 2, 2520);
    			attr_dev(div, "class", "main-container svelte-1jd0b7i");
    			add_location(div, file$a, 103, 0, 2658);
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
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t1);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t2);
    			if (if_block2) if_block2.m(div, null);
    			append_dev(div, t3);
    			mount_component(header, div, null);
    			append_dev(div, t4);
    			mount_component(model, div, null);
    			append_dev(div, t5);
    			if (if_block3) if_block3.m(div, null);
    			append_dev(div, t6);
    			mount_component(footer, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*isModelVisible*/ ctx[4]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*isModelVisible*/ 16) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3$1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div, t1);
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
    					if_block1 = create_if_block_2$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t2);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*openLegal*/ ctx[6]) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*openLegal*/ 64) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1$1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div, t3);
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
    			if (dirty & /*content*/ 1) header_changes.subheadline = /*content*/ ctx[0].header.subheadline_desktop;
    			if (dirty & /*content*/ 1) header_changes.arrow = /*content*/ ctx[0].assets.down_arrow;
    			header.$set(header_changes);
    			const model_changes = {};
    			if (dirty & /*modelViewer*/ 8) model_changes.modelViewer = /*modelViewer*/ ctx[3];
    			if (dirty & /*content*/ 1) model_changes.model = /*content*/ ctx[0].assets.model;
    			if (dirty & /*content*/ 1) model_changes.lights = /*content*/ ctx[0].assets.lights;
    			if (dirty & /*content*/ 1) model_changes.background = /*content*/ ctx[0].assets.background;
    			if (dirty & /*content*/ 1) model_changes.checkmark = /*content*/ ctx[0].assets.checkmark;
    			if (dirty & /*content*/ 1) model_changes.hotspot = /*content*/ ctx[0].hotspots;
    			if (dirty & /*content*/ 1) model_changes.blueCheckmark = /*content*/ ctx[0].assets.blue_checkmark;
    			if (dirty & /*content*/ 1) model_changes.backCopy = /*content*/ ctx[0].back_copy;
    			if (dirty & /*content*/ 1) model_changes.backArrow = /*content*/ ctx[0].assets.back_arrow;
    			if (dirty & /*content*/ 1) model_changes.zoomifyGlass = /*content*/ ctx[0].assets.zoomify_glass;
    			if (dirty & /*content*/ 1) model_changes.landscapeImg = /*content*/ ctx[0].assets.zoomify_glassFront;
    			if (dirty & /*content*/ 1) model_changes.zoomifyGlassShadow = /*content*/ ctx[0].assets.zoomify_glassBack;
    			model.$set(model_changes);

    			if (/*openVideo*/ ctx[5]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty & /*openVideo*/ 32) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block$1(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div, t6);
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
    			if (detaching) detach_dev(div);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { content } = $$props;
    	let { video } = $$props;
    	let featureId = -1;
    	let modelViewer = "";
    	let isModelVisible = false;
    	let openVideo = false;
    	let openLegal = false;
    	let showBlurryScreen = false;

    	onMount(function () {
    		$$invalidate(3, modelViewer = document.getElementById("unit01"));
    	});

    	function isVisible(event) {
    		$$invalidate(4, isModelVisible = event.detail);
    		fadeInAnimation();
    	}

    	function closeVideoHandler(event) {
    		$$invalidate(7, showBlurryScreen = event.detail);
    		$$invalidate(5, openVideo = event.detail);
    	}

    	function openVideoHandler(event) {
    		$$invalidate(7, showBlurryScreen = event.detail.active);
    		$$invalidate(5, openVideo = event.detail.active);
    		$$invalidate(2, featureId = event.detail.actualId);
    	}

    	function openModalHandler(event) {
    		$$invalidate(7, showBlurryScreen = event.detail);
    		$$invalidate(6, openLegal = event.detail);
    	}

    	function closeModalHandler(event) {
    		$$invalidate(7, showBlurryScreen = event.detail);
    		$$invalidate(6, openLegal = event.detail);
    	}

    	function fadeInAnimation() {
    		let fadeInModel = new TimelineMax();
    		fadeInModel.set(".ModeViewerHolder", { opacity: 0, visibility: "visible" });
    		fadeInModel.set(modelViewer, { opacity: 0 });
    		fadeInModel.add("modelIntroAnim");
    		fadeInModel.set(modelViewer, { y: "30%" });
    		fadeInModel.to(".ModeViewerHolder", 3, { opacity: 1, ease: "power4.out" }, "modelIntroAnim");
    		fadeInModel.to(modelViewer, 2.5, { opacity: 1, ease: "Expo.easeOut" }, "modelIntroAnim");
    		fadeInModel.to(modelViewer, 2, { y: "0%", ease: "Expo.easeOut" }, "modelIntroAnim");
    	}

    	const writable_props = ["content", "video"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("content" in $$props) $$invalidate(0, content = $$props.content);
    		if ("video" in $$props) $$invalidate(1, video = $$props.video);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		Footer,
    		Header,
    		Model,
    		LoadingScreen,
    		VideoPlayer,
    		BlurryScreen,
    		Legal,
    		content,
    		video,
    		featureId,
    		modelViewer,
    		isModelVisible,
    		openVideo,
    		openLegal,
    		showBlurryScreen,
    		isVisible,
    		closeVideoHandler,
    		openVideoHandler,
    		openModalHandler,
    		closeModalHandler,
    		fadeInAnimation
    	});

    	$$self.$inject_state = $$props => {
    		if ("content" in $$props) $$invalidate(0, content = $$props.content);
    		if ("video" in $$props) $$invalidate(1, video = $$props.video);
    		if ("featureId" in $$props) $$invalidate(2, featureId = $$props.featureId);
    		if ("modelViewer" in $$props) $$invalidate(3, modelViewer = $$props.modelViewer);
    		if ("isModelVisible" in $$props) $$invalidate(4, isModelVisible = $$props.isModelVisible);
    		if ("openVideo" in $$props) $$invalidate(5, openVideo = $$props.openVideo);
    		if ("openLegal" in $$props) $$invalidate(6, openLegal = $$props.openLegal);
    		if ("showBlurryScreen" in $$props) $$invalidate(7, showBlurryScreen = $$props.showBlurryScreen);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		content,
    		video,
    		featureId,
    		modelViewer,
    		isModelVisible,
    		openVideo,
    		openLegal,
    		showBlurryScreen,
    		isVisible,
    		closeVideoHandler,
    		openVideoHandler,
    		openModalHandler,
    		closeModalHandler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { content: 0, video: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*content*/ ctx[0] === undefined && !("content" in props)) {
    			console.warn("<App> was created without expected prop 'content'");
    		}

    		if (/*video*/ ctx[1] === undefined && !("video" in props)) {
    			console.warn("<App> was created without expected prop 'video'");
    		}
    	}

    	get content() {
    		return this.$$.ctx[0];
    	}

    	set content(content) {
    		this.$set({ content });
    		flush();
    	}

    	get video() {
    		return this.$$.ctx[1];
    	}

    	set video(video) {
    		this.$set({ video });
    		flush();
    	}
    }

    window.evo3DMobile = function ($el, content, video) {
    	let app = new App({
    		target: $el,
    		props: {
    			content,
    			video
    		}
    	});
    	return app;
    };

}());
//# sourceMappingURL=bundle.js.map
