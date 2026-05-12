{% if grains['kernel'] == 'Linux' and grains['os_family'] == 'Debian' %}
itms-linux-packages-upgraded:
  module.run:
    - pkg.upgrade:
      - refresh: true
      - dist_upgrade: true

{% elif grains['kernel'] == 'Windows' %}
itms-patch-run-unsupported-windows:
  test.fail_without_changes:
    - name: patch.run is only implemented in this repo for Ubuntu or Debian Linux targets.

{% else %}
itms-patch-run-unsupported-platform:
  test.fail_without_changes:
    - name: patch.run only ships example package update commands for Ubuntu or Debian Linux targets.
{% endif %}