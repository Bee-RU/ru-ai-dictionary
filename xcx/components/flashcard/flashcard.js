Component({
  properties: {
    entry: { type: Object, value: null }
  },
  data: { isFlipped: false },
  methods: {
    onFlip() { this.setData({ isFlipped: !this.data.isFlipped }); }
  }
});
