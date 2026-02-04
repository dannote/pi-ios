extern "C" {
void Bun__errorInstance__finalize(void*, void*) {}
struct WTFTimer;
void WTFTimer__cancel(WTFTimer*) {}
void* WTFTimer__create(void*, void*) { return nullptr; }
void WTFTimer__deinit(WTFTimer*) {}
bool WTFTimer__isActive(WTFTimer*) { return false; }
double WTFTimer__secondsUntilTimer(WTFTimer*) { return 0; }
void WTFTimer__update(WTFTimer*, unsigned long long) {}
}
