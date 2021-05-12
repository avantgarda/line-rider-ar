AFRAME.registerComponent('my-animation', {
  init: function () {
    var self = this;
    this.time = 0;
    this.animation = AFRAME.ANIME({
      targets: [{ x: -Math.PI / 2, y: 0, z: 0 }],
      x: -Math.PI / 2, y: 0, z: 2 * Math.PI,
      autoplay: false,
      duration: 20000,
      easing: "linear",
      loop: true,
      round: false,
      update: function (animation) {
        var value = animation.animatables[0].target;
        self.el.object3D.rotation.set(value.x, value.y, value.z);
      }
    });
    this.animation.began = true;

  },
  tick: function (t, dt) {
    this.time += dt;
    this.animation.tick(this.time);
  }
});

AFRAME.registerComponent('keyframe-animation', {
  init: function () {
    var self = this;
    this.time = 0;
    this.animation = AFRAME.ANIME({
      targets: [{ x: 0, y: 0.5, z: 0 }],  
      x: 0, y: 0.5, z: 0,
      keyframes: [
        {translateY: -1},
        {translateX: 4},
        {translateY: 1},
        {translateX: 0},
        {translateY: 0}
      ],
      duration: 5000,
      easing: "linear",
      loop: true,
      update: function (animation) {
        var value = animation.animatables[0].target;
        self.el.object3D.position.set(value.x, value.y, value.z);
      }
    });
    this.animation.began = true;

  },
  tick: function (t, dt) {
    this.time += dt;
    this.animation.tick(this.time);
  }
});