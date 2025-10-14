(function(){
    const orbital = window.orbital = {};

    const maxLayers = 30;
    const softLimitAnimations = 100; // Start probabilistic dropping earlier
    const hardLimitAnimations = 400; // Higher ceiling for more gradual curve
    const dateKeyFunc = function(){
        return new Date().getMinutes();
    };
    let lastDateKey = null;
    let element = null;
    let layers = [];
    let activeLayer;
    const adjustOffset = 0;
    const targetHeight = 1800;
    const targetWidth = 3600;
    let setHeight;
    let setWidth;
    let windowInFocus = true;
    let animationCanvas = null;
    let animationCtx = null;
    const activeAnimations = [];
    let droppedEvents = 0;

    window.addEventListener('focus', function() {
        windowInFocus = true;
    });

    window.addEventListener('blur', function() {
        windowInFocus = false;
    });

    // Animation system to replace jCanvaScript
    class CircleAnimation {
        constructor(x, y, startRadius, endRadius, startOpacity, endOpacity, duration, color, onComplete) {
            this.x = x;
            this.y = y;
            this.startRadius = startRadius;
            this.endRadius = endRadius;
            this.startOpacity = startOpacity;
            this.endOpacity = endOpacity;
            this.duration = duration;
            this.color = color;
            this.colorKey = `${color[0]},${color[1]},${color[2]}`;
            this.onComplete = onComplete;
            this.startTime = Date.now();
            this.completed = false;
        }

        update() {
            const elapsed = Date.now() - this.startTime;
            const progress = Math.min(elapsed / this.duration, 1);

            if (progress >= 1) {
                this.completed = true;
                if (this.onComplete) {
                    this.onComplete();
                }
                return;
            }

            this.currentRadius = this.startRadius + (this.endRadius - this.startRadius) * progress;
            this.currentOpacity = this.startOpacity + (this.endOpacity - this.startOpacity) * progress;
        }
    }

    function animate() {
        if (!animationCtx) return;

        animationCtx.clearRect(0, 0, animationCanvas.width, animationCanvas.height);

        // Update all animations and group by color
        const byColor = new Map();
        for (let i = activeAnimations.length - 1; i >= 0; i--) {
            const anim = activeAnimations[i];
            anim.update();

            if (anim.completed) {
                activeAnimations.splice(i, 1);
            } else {
                // Group animations by color for batched drawing
                if (!byColor.has(anim.colorKey)) {
                    byColor.set(anim.colorKey, []);
                }
                byColor.get(anim.colorKey).push(anim);
            }
        }

        // Batch draw by color to minimize context state changes
        byColor.forEach((anims, colorKey) => {
            const firstAnim = anims[0];
            animationCtx.fillStyle = `rgba(${firstAnim.color[0]}, ${firstAnim.color[1]}, ${firstAnim.color[2]}, 1)`;

            anims.forEach(anim => {
                animationCtx.globalAlpha = anim.currentOpacity;
                animationCtx.beginPath();
                animationCtx.arc(anim.x, anim.y, anim.currentRadius, 0, Math.PI * 2, false);
                animationCtx.fill();
            });

            animationCtx.globalAlpha = 1; // Reset
        });

        requestAnimationFrame(animate);
    }

    function sizePageElements() {
        const geo = document.getElementById('geo');
        const body = document.body;

        geo.style.height = (body.offsetHeight - adjustOffset) + 'px';

        if (geo.offsetWidth / geo.offsetHeight > 2) {
            orbital.scale = geo.offsetHeight / targetHeight;
        } else {
            orbital.scale = geo.offsetWidth / targetWidth;
        }

        element.style.top = (geo.offsetHeight - targetHeight * orbital.scale) + 'px';
        element.style.left = ((geo.offsetWidth - targetWidth * orbital.scale) / 2) + 'px';

        setWidth = element.offsetWidth;
        setHeight = element.offsetHeight;

        const mapdata = document.getElementById('mapdata');
        mapdata.style.transform = `scale(${orbital.scale})`;

        const canvases = element.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            canvas.style.width = setWidth + 'px';
            canvas.style.height = setHeight + 'px';
            canvas.width = setWidth;
            canvas.height = setHeight;
        });
    }

    orbital.stream = null;
    orbital.source = null;
    orbital.scale = 1;

    orbital.getColor = function(data) {
        switch (data.platform) {
            case 'java':
                return [255, 138, 0];
            case 'javascript':
                return [248, 220, 60];
            case 'php':
                return [95, 129, 186];
            case 'python':
                return [55, 118, 171];
            case 'ruby':
                return [217, 19, 4];
            default:
                return [255, 255, 255];
        }
    };

    orbital.addData = function(data) {
        const currentAnimations = activeAnimations.length;

        // Hard limit - never exceed this
        if (currentAnimations >= hardLimitAnimations) {
            droppedEvents++;
            return;
        }

        // Soft limit - probabilistic dropping for smooth degradation
        if (currentAnimations >= softLimitAnimations) {
            // Use exponential curve for smoother drop probability
            const overload = currentAnimations - softLimitAnimations;
            const range = hardLimitAnimations - softLimitAnimations;
            const normalizedLoad = overload / range;
            // Exponential curve: starts slower, ramps up gradually
            const dropProbability = Math.pow(normalizedLoad, 1.5) * 0.95;

            if (Math.random() < dropProbability) {
                droppedEvents++;
                if (droppedEvents % 100 === 0) {
                    console.warn(`Performance throttle: ${currentAnimations} active animations, dropped ${droppedEvents} events total`);
                }
                return;
            }
        }

        const x = ~~((parseFloat(data.lng) + 180) * 10) * orbital.scale;
        const y = ~~((-parseFloat(data.lat) + 90) * 10) * orbital.scale;

        const color = orbital.getColor(data);

        // Much wider randomization (200-500ms) to prevent any synchronization
        const duration = 200 + Math.random() * 300;

        // Randomize animation parameters slightly for more organic feel
        const startRadius = 4 + Math.random() * 2; // 4-6
        const endRadius = 0.8 + Math.random() * 0.4; // 0.8-1.2

        // Create and animate our point
        const animation = new CircleAnimation(
            x, y,
            startRadius, endRadius,
            1, 0.4,
            duration,
            color,
            function() {
                // After animation completes, draw permanent dot on active layer
                if (activeLayer) {
                    activeLayer.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`;
                    activeLayer.beginPath();
                    activeLayer.arc(x, y, 1, 0, Math.PI * 2, false);
                    activeLayer.fill();
                }
            }
        );

        activeAnimations.push(animation);
    };

    orbital.connect = function(){
        orbital.disconnect();

        orbital.source = new EventSource(orbital.stream);
        orbital.source.onopen = function(e) {
            console.log('[Stream] Connection opened to ' + orbital.stream);
        };

        orbital.source.onmessage = function(e){
            if (windowInFocus) {
                const data = JSON.parse(e.data);
                orbital.addData({
                    lat: data[0],
                    lng: data[1],
                    ts: data[2],
                    platform: data[3]
                });
            }
        };

        orbital.source.onerror = function(e) {
            console.error('[Stream] Connection error', e);
        };
    };

    orbital.disconnect = function(){
        if (orbital.source) {
            console.log('[Stream] Closing connection to ' + orbital.stream);
            orbital.source.onclose = function(){};
            orbital.source.close();
            orbital.source = null;
        }
    };

    orbital.createLayer = function(dateKey){
        const layer = document.createElement('canvas');
        layer.setAttribute('data-date-key', dateKey);
        layer.style.width = setWidth + 'px';
        layer.style.height = setHeight + 'px';
        layer.width = setWidth;
        layer.height = setHeight;

        element.appendChild(layer);
        layers.push(layer);

        return layer;
    };

    orbital.watchActiveLayer = function() {
        const dateKey = dateKeyFunc();

        if (dateKey === lastDateKey) {
            setTimeout(orbital.watchActiveLayer, 3000);
            return;
        }

        lastDateKey = dateKey;

        // create a new layer
        const layer = orbital.createLayer(dateKey);

        // set the new layer as the active layer
        activeLayer = layer.getContext('2d');

        // remove excess layers
        if (layers.length > maxLayers) {
            const excess = layers.slice(maxLayers);
            layers = layers.slice(0, maxLayers);

            excess.forEach(function(excessLayer) {
                console.log('Removing layer ( ' + excessLayer.getAttribute('data-date-key') + ' )');
                excessLayer.remove();
            });
        }

        setTimeout(orbital.watchActiveLayer, 3000);
    };

    orbital.init = function(containerElement) {
        element = containerElement;

        orbital.stream = '/stream';

        sizePageElements();

        // Initialize animation canvas
        animationCanvas = document.getElementById('pings');
        animationCtx = animationCanvas.getContext('2d');

        // Start animation loop
        animate();

        orbital.watchActiveLayer();

        window.addEventListener('beforeunload', function() {
            orbital.disconnect();
        });

        window.addEventListener('resize', sizePageElements);

        orbital.connect();
    };
})();
