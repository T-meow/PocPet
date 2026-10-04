import Matter from 'matter-js';
import { fruits, FRUIT_HEIGHT, FRUIT_WIDTH, DANGER_LINE } from './catalog';
import { nextFruit, type FruitBody, type FruitState } from './state';
import { clone } from '../shared/state';

export class FruitSimulation {
  readonly engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 8 });
  private state: FruitState;
  private bodies = new Map<number, { body: Matter.Body; info: FruitBody }>();
  private contacts: [number, number][] = [];
  private disposed = false;
  constructor(snapshot: FruitState) {
    this.state = clone(snapshot);
    this.engine.gravity.y = 1;
    Matter.Composite.add(this.engine.world, [
      Matter.Bodies.rectangle(0, FRUIT_HEIGHT / 2, 12, FRUIT_HEIGHT * 3, { isStatic: true }),
      Matter.Bodies.rectangle(FRUIT_WIDTH, FRUIT_HEIGHT / 2, 12, FRUIT_HEIGHT * 3, { isStatic: true }),
      Matter.Bodies.rectangle(FRUIT_WIDTH / 2, FRUIT_HEIGHT, FRUIT_WIDTH, 12, { isStatic: true }),
    ]);
    snapshot.bodies.forEach(b => this.add(b));
    const contact = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const { bodyA, bodyB } of event.pairs) {
        const a = this.bodies.get(bodyA.plugin.fruitId as number), b = this.bodies.get(bodyB.plugin.fruitId as number);
        if (a) a.info.landed = true;
        if (b) b.info.landed = true;
        if (a && b && a.info.tier === b.info.tier && a.info.tier < fruits.length - 1) this.contacts.push([a.info.id, b.info.id]);
      }
    };
    Matter.Events.on(this.engine, 'collisionStart', contact);
    Matter.Events.on(this.engine, 'collisionActive', contact);
  }
  private add(info: FruitBody) {
    const body = Matter.Bodies.circle(info.x, info.y, fruits[info.tier].radius, { restitution: .12, friction: .18, frictionStatic: .4, frictionAir: .008, slop: .025, density: .0015, sleepThreshold: 90, plugin: { fruitId: info.id } });
    Matter.Body.setVelocity(body, { x: info.vx, y: info.vy }); Matter.Body.setAngle(body, info.angle); Matter.Body.setAngularVelocity(body, info.angularVelocity);
    this.bodies.set(info.id, { body, info: { ...info } }); Matter.Composite.add(this.engine.world, body);
  }
  aim(x: number) { const r = fruits[this.state.current].radius; this.state.aim = Math.max(r + 7, Math.min(FRUIT_WIDTH - r - 7, x)); }
  drop() {
    if (this.disposed || this.state.over || this.state.dropCooldownMs > 0) return false;
    if (this.bodies.size >= 180) { this.state.over = true; return false; }
    this.aim(this.state.aim);
    this.add({ id: this.state.nextId++, tier: this.state.current, x: this.state.aim, y: 28, vx: 0, vy: 0, angle: 0, angularVelocity: 0, landed: false });
    const next = nextFruit(this.state.seed); this.state.current = this.state.next; this.state.next = next.tier; this.state.seed = next.seed; this.state.dropCooldownMs = 450; this.aim(this.state.aim);
    return true;
  }
  step(delta = 1000 / 60) {
    const events = { merged: 0, watermelon: false, ended: false };
    if (this.disposed || this.state.over) return events;
    this.state.dropCooldownMs = Math.max(0, this.state.dropCooldownMs - delta);
    this.contacts = []; Matter.Engine.update(this.engine, delta);
    // Process contacts after the solver. Deleting both entries makes repeated/contact-chain pairs harmless.
    for (const [aId, bId] of this.contacts) {
      const a = this.bodies.get(aId), b = this.bodies.get(bId); if (!a || !b) continue;
      const tier = a.info.tier + 1, r = fruits[tier].radius;
      Matter.Composite.remove(this.engine.world, [a.body, b.body]); this.bodies.delete(aId); this.bodies.delete(bId);
      this.add({ id: this.state.nextId++, tier, x: Math.max(r + 7, Math.min(FRUIT_WIDTH - r - 7, (a.body.position.x + b.body.position.x) / 2)), y: Math.min(FRUIT_HEIGHT - r - 7, (a.body.position.y + b.body.position.y) / 2), vx: 0, vy: -.3, angle: 0, angularVelocity: 0, landed: true });
      this.state.score += (tier + 1) * 10; this.state.best = Math.max(this.state.best, this.state.score); events.merged++;
      if (tier === fruits.length - 1 && !this.state.celebrated) { this.state.celebrated = true; events.watermelon = true; }
    }
    const danger = [...this.bodies.values()].some(({ body, info }) => info.landed && body.position.y - fruits[info.tier].radius < DANGER_LINE);
    this.state.dangerMs = danger ? Math.min(3000, this.state.dangerMs + delta) : 0;
    if (this.state.dangerMs >= 3000) { this.state.over = true; events.ended = true; }
    return events;
  }
  snapshot(): FruitState {
    return { ...this.state, bodies: [...this.bodies.values()].map(({ body, info }) => ({ ...info, x: body.position.x, y: body.position.y, vx: body.velocity.x, vy: body.velocity.y, angle: body.angle, angularVelocity: body.angularVelocity })) };
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true; Matter.Events.off(this.engine, 'collisionStart'); Matter.Events.off(this.engine, 'collisionActive'); Matter.Composite.clear(this.engine.world, false); Matter.Engine.clear(this.engine);
  }
}
