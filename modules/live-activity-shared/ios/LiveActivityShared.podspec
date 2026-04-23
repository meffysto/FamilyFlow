Pod::Spec.new do |s|
  s.name           = 'LiveActivityShared'
  s.version        = '1.0.0'
  s.summary        = 'ActivityAttributes partagés entre VaultAccess et le widget MaJourneeWidget'
  s.description    = <<-DESC
    Fournit FeedingActivityAttributes et MascotteActivityAttributes comme
    types publics d'un module Swift unique, pour que l'App Intent du widget
    puisse retrouver et mettre à jour la Live Activity démarrée par l'app.
  DESC
  s.homepage       = 'https://github.com/meffysto/FamilyFlow'
  s.license        = 'MIT'
  s.author         = 'Family Vault'
  s.source         = { git: '' }
  # Platform iOS 15.1 = plus bas commun avec VaultAccess (15.1) et le widget
  # target (16.0). Les types ActivityKit sont guardés par @available(iOS 16.2).
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'
  s.source_files   = 'Sources/**/*.swift'
  # Pas de s.frameworks explicites : Swift autolink gère ActivityKit via les
  # `import` dans les sources. Déclarer -framework ici propage la ref à tous
  # les consommateurs et complique le scrub SwiftUICore iOS 18 SDK.

  # DEFINES_MODULE=YES → le module Swift `LiveActivityShared` est exposable à
  # `import` depuis VaultAccess et le widget.
  # BUILD_LIBRARY_FOR_DISTRIBUTION=NO → pas de .swiftinterface ; évite de
  # propager les références implicites d'ActivityKit à SwiftUICore (framework
  # privé, non linkable par les apps) sur iOS 18 SDK.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'BUILD_LIBRARY_FOR_DISTRIBUTION' => 'NO',
  }
end
