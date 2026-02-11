import SwiftUI
import UIKit

// MARK: - Keyboard Accessory View

@available(iOS 17.0, *)
struct KeyboardAccessoryBar: View {
  @Binding var controlActive: Bool
  let onTab: () -> Void
  let onEscape: () -> Void
  let onArrow: (ArrowDirection) -> Void
  let onPaste: () -> Void
  let onHideKeyboard: () -> Void

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
  @Namespace private var glassNamespace

  private var isIPad: Bool {
    UIDevice.current.userInterfaceIdiom == .pad
  }

  var body: some View {
    accessoryContent
      .padding(.horizontal, 8)
      .padding(.vertical, 6)
      .frame(height: isIPad ? 50 : 44)
      .background { backgroundView }
  }

  @ViewBuilder
  private var accessoryContent: some View {
    if #available(iOS 26.0, *) {
      GlassEffectContainer(spacing: 8) {
        accessoryButtons
      }
    } else {
      accessoryButtons
    }
  }

  private var accessoryButtons: some View {
    HStack(spacing: 6) {
      // Left group: Tab, Control, Escape
      HStack(spacing: 4) {
        AccessoryKey(
          icon: "arrow.right.to.line", label: "Tab", namespace: glassNamespace, action: onTab)

        AccessoryKey(
          icon: "control",
          label: "Control",
          isToggle: true,
          isActive: $controlActive,
          namespace: glassNamespace
        ) {
          controlActive.toggle()
        }

        AccessoryKey(icon: "escape", label: "Esc", namespace: glassNamespace, action: onEscape)
      }

      Spacer()

      // Center: Arrow keys
      ArrowKeyCluster(namespace: glassNamespace, onArrow: onArrow)

      Spacer()

      // Right group: Paste, Hide Keyboard
      HStack(spacing: 4) {
        AccessoryKey(
          icon: "doc.on.clipboard", label: "Paste", namespace: glassNamespace, action: onPaste)

        if !isIPad {
          AccessoryKey(
            icon: "keyboard.chevron.compact.down", label: "Hide", namespace: glassNamespace,
            action: onHideKeyboard)
        }
      }
    }
  }

  @ViewBuilder
  private var backgroundView: some View {
    if #available(iOS 26.0, *), !reduceTransparency {
      Color.clear
    } else {
      Rectangle().fill(.ultraThinMaterial)
    }
  }
}

// MARK: - Arrow Direction

enum ArrowDirection {
  case arrowUp, arrowDown, arrowLeft, arrowRight
}

// MARK: - Individual Key Button

@available(iOS 17.0, *)
struct AccessoryKey: View {
  let icon: String
  let label: String
  var isToggle: Bool = false
  var isActive: Binding<Bool>?
  var namespace: Namespace.ID
  let action: () -> Void

  @State private var isPressed = false
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  private var isOn: Bool {
    isActive?.wrappedValue ?? false
  }

  var body: some View {
    Button(action: {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
      action()
    }) {
      Image(systemName: icon)
        .font(.system(size: 16, weight: .medium))
        .foregroundStyle(isOn ? .white : .primary)
        .frame(width: 36, height: 36)
        .background { keyBackground }
        .modifier(
          GlassModifier(
            id: label, namespace: namespace, isActive: isOn, reduceTransparency: reduceTransparency)
        )
    }
    .buttonStyle(KeyPressStyle(isPressed: $isPressed))
    .accessibilityLabel(label)
    .accessibilityAddTraits(isToggle ? .isToggle : [])
    .accessibilityValue(isToggle ? (isOn ? "On" : "Off") : "")
  }

  @ViewBuilder
  private var keyBackground: some View {
    if isOn {
      RoundedRectangle(cornerRadius: 8, style: .continuous).fill(.tint)
    } else if #available(iOS 26.0, *), !reduceTransparency {
      Color.clear
    } else {
      GlassKeyBackground(isPressed: isPressed, colorScheme: colorScheme)
    }
  }
}

// MARK: - Glass Modifier (iOS 26+)

struct GlassModifier: ViewModifier {
  let id: String
  let namespace: Namespace.ID
  let isActive: Bool
  let reduceTransparency: Bool

  func body(content: Content) -> some View {
    if #available(iOS 26.0, *), !reduceTransparency, !isActive {
      content
        .glassEffect(
          .regular.interactive(), in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
        .glassEffectID(id, in: namespace)
    } else {
      content
    }
  }
}

// MARK: - Arrow Key Cluster

@available(iOS 17.0, *)
struct ArrowKeyCluster: View {
  var namespace: Namespace.ID
  let onArrow: (ArrowDirection) -> Void

  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  var body: some View {
    HStack(spacing: 2) {
      ArrowKey(direction: .arrowLeft, namespace: namespace, onTap: onArrow)
      VStack(spacing: 2) {
        ArrowKey(direction: .arrowUp, namespace: namespace, onTap: onArrow)
        ArrowKey(direction: .arrowDown, namespace: namespace, onTap: onArrow)
      }
      ArrowKey(direction: .arrowRight, namespace: namespace, onTap: onArrow)
    }
    .padding(4)
    .background { clusterBackground }
  }

  @ViewBuilder
  private var clusterBackground: some View {
    if #available(iOS 26.0, *), !reduceTransparency {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .glassEffectID("arrows", in: namespace)
    } else {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(.ultraThinMaterial)
        .shadow(color: .black.opacity(0.1), radius: 1, y: 1)
    }
  }
}

@available(iOS 17.0, *)
struct ArrowKey: View {
  let direction: ArrowDirection
  var namespace: Namespace.ID
  let onTap: (ArrowDirection) -> Void

  @State private var isPressed = false
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  private var iconName: String {
    switch direction {
    case .arrowUp: return "chevron.up"
    case .arrowDown: return "chevron.down"
    case .arrowLeft: return "chevron.left"
    case .arrowRight: return "chevron.right"
    }
  }

  var body: some View {
    Button {
      UIImpactFeedbackGenerator(style: .light).impactOccurred()
      onTap(direction)
    } label: {
      Image(systemName: iconName)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
        .frame(width: 32, height: 24)
        .background { arrowBackground }
    }
    .buttonStyle(KeyPressStyle(isPressed: $isPressed))
    .accessibilityLabel("\(direction) arrow")
  }

  @ViewBuilder
  private var arrowBackground: some View {
    if #available(iOS 26.0, *), !reduceTransparency {
      Color.clear
        .glassEffect(
          .regular.interactive(), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
    } else {
      GlassKeyBackground(isPressed: isPressed, colorScheme: colorScheme)
    }
  }
}

// MARK: - Glass Key Background (Fallback)

@available(iOS 17.0, *)
struct GlassKeyBackground: View {
  let isPressed: Bool
  let colorScheme: ColorScheme

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .fill(
          colorScheme == .dark
            ? Color.white.opacity(isPressed ? 0.15 : 0.1)
            : Color.white.opacity(isPressed ? 0.6 : 0.8))

      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .strokeBorder(
          colorScheme == .dark ? Color.white.opacity(0.2) : Color.black.opacity(0.08),
          lineWidth: 0.5
        )

      if !isPressed {
        RoundedRectangle(cornerRadius: 7, style: .continuous)
          .fill(
            LinearGradient(
              colors: [
                colorScheme == .dark ? Color.white.opacity(0.15) : Color.white.opacity(0.5), .clear
              ],
              startPoint: .top, endPoint: .center
            )
          )
          .padding(1)
      }
    }
    .shadow(
      color: colorScheme == .dark ? .black.opacity(0.3) : .black.opacity(0.15),
      radius: isPressed ? 0 : 1, y: isPressed ? 0 : 1)
  }
}

// MARK: - Button Style

struct KeyPressStyle: ButtonStyle {
  @Binding var isPressed: Bool

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
      .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
      .onChange(of: configuration.isPressed) { _, new in isPressed = new }
  }
}

// MARK: - UIKit Wrapper

@available(iOS 17.0, *)
class KeyboardAccessoryInputView: UIInputView {
  private var hostingController: UIHostingController<AnyView>?

  override init(frame: CGRect, inputViewStyle: UIInputView.Style) {
    super.init(frame: frame, inputViewStyle: inputViewStyle)
    backgroundColor = .clear
    allowsSelfSizing = true
  }

  required init?(coder: NSCoder) { fatalError() }

  func setContent<V: View>(_ view: V) {
    hostingController?.view.removeFromSuperview()

    let hostController = UIHostingController(rootView: AnyView(view))
    hostController.view.backgroundColor = .clear
    hostController.view.translatesAutoresizingMaskIntoConstraints = false

    addSubview(hostController.view)
    NSLayoutConstraint.activate([
      hostController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      hostController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      hostController.view.topAnchor.constraint(equalTo: topAnchor),
      hostController.view.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    hostingController = hostController
  }

  override var intrinsicContentSize: CGSize {
    CGSize(
      width: UIView.noIntrinsicMetric, height: UIDevice.current.userInterfaceIdiom == .pad ? 50 : 44
    )
  }
}

// MARK: - Coordinator (manages state between SwiftUI and UIKit)

@available(iOS 17.0, *)
@MainActor
class KeyboardAccessoryCoordinator: ObservableObject {
  @Published var controlActive = false

  private(set) var inputView: KeyboardAccessoryInputView?
  weak var terminalView: TerminalView?

  init() {
    setupInputView()
  }

  private func setupInputView() {
    let height: CGFloat = UIDevice.current.userInterfaceIdiom == .pad ? 50 : 44
    inputView = KeyboardAccessoryInputView(
      frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: height),
      inputViewStyle: .keyboard
    )
    updateContent()
  }

  private func updateContent() {
    let bar = KeyboardAccessoryBar(
      controlActive: Binding(get: { self.controlActive }, set: { self.controlActive = $0 }),
      onTab: { [weak self] in self?.sendTab() },
      onEscape: { [weak self] in self?.sendEscape() },
      onArrow: { [weak self] dir in self?.sendArrow(dir) },
      onPaste: { [weak self] in self?.paste() },
      onHideKeyboard: { [weak self] in self?.hideKeyboard() }
    )
    inputView?.setContent(bar)
  }

  private func sendTab() {
    terminalView?.onInput?("\t")
  }

  private func sendEscape() {
    terminalView?.onInput?("\u{1b}")
  }

  private func sendArrow(_ direction: ArrowDirection) {
    let seq: String
    switch direction {
    case .arrowUp: seq = "\u{1b}[A"
    case .arrowDown: seq = "\u{1b}[B"
    case .arrowLeft: seq = "\u{1b}[D"
    case .arrowRight: seq = "\u{1b}[C"
    }
    terminalView?.onInput?(seq)
  }

  private func paste() {
    if let text = UIPasteboard.general.string {
      terminalView?.onInput?(text)
    }
  }

  private func hideKeyboard() {
    terminalView?.resignFirstResponder()
  }
}
