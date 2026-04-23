Pod::Spec.new do |s|
  s.name           = 'VaultAccess'
  s.version        = '1.0.0'
  s.summary        = 'iOS security-scoped folder access for Family Vault'
  s.homepage       = 'https://github.com/meffysto/FamilyFlow'
  s.license        = 'MIT'
  s.author         = 'Family Vault'
  s.source         = { git: '' }
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
  s.dependency 'LiveActivityShared'
end
